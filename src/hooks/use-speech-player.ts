"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HostId, ScriptLine } from "@/lib/types";

export type PlayerStatus = "idle" | "playing" | "paused" | "ended" | "unsupported";
type TtsMode = "cartesia" | "browser" | "checking";

function voiceScore(voice: SpeechSynthesisVoice, host: HostId): number {
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase();
  let n = 0;
  if (lang.startsWith("en")) n += 5;
  if (lang.includes("us") || lang.includes("gb") || lang.includes("uk")) n += 1;
  if (host === "maya") {
    if (/female|samantha|victoria|karen|moira|zira|siri|google us english$/.test(name))
      n += 6;
    if (/male|david|daniel|fred|alex|george/.test(name)) n -= 3;
  } else {
    if (/male|david|daniel|fred|alex|george|microsoft david/.test(name)) n += 6;
    if (/female|samantha|victoria|zira/.test(name)) n -= 3;
  }
  if (voice.localService) n += 2;
  return n;
}

function pickVoice(
  voices: SpeechSynthesisVoice[],
  host: HostId,
  used?: SpeechSynthesisVoice
): SpeechSynthesisVoice | null {
  const ranked = [...voices].sort((a, b) => voiceScore(b, host) - voiceScore(a, host));
  const best = ranked.find((v) => v !== used) ?? ranked[0];
  return best ?? null;
}

async function fetchCartesiaAudio(
  text: string,
  host: HostId
): Promise<string | null> {
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice: host }),
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export function useSpeechPlayer(lines: ScriptLine[]) {
  const [status, setStatus] = useState<PlayerStatus>("idle");
  const [index, setIndex] = useState(0);
  const [rate, setRate] = useState(1);
  const [voicesReady, setVoicesReady] = useState(false);
  const [voiceNames, setVoiceNames] = useState<{ maya?: string; jordan?: string }>({});
  const [ttsMode, setTtsMode] = useState<TtsMode>("checking");
  const indexRef = useRef(0);
  const rateRef = useRef(1);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const cancelledRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prefetchRef = useRef<Map<number, Promise<string | null>>>(new Map());

  useEffect(() => {
    let mounted = true;
    fetch("/api/tts")
      .then((r) => r.json())
      .then((body: { available?: boolean }) => {
        if (!mounted) return;
        setTtsMode(body.available ? "cartesia" : "browser");
        if (body.available) {
          setVoiceNames({ maya: "Cartesia", jordan: "Cartesia" });
          setVoicesReady(true);
        }
      })
      .catch(() => {
        if (mounted) setTtsMode("browser");
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (ttsMode !== "browser") return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () => {
      const list = window.speechSynthesis.getVoices();
      if (!list.length) return;
      voicesRef.current = list;
      const maya = pickVoice(list, "maya");
      const jordan = pickVoice(list, "jordan", maya ?? undefined);
      setVoiceNames({ maya: maya?.name, jordan: jordan?.name });
      setVoicesReady(true);
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [ttsMode]);

  const prefetch = useCallback(
    (i: number) => {
      if (ttsMode !== "cartesia") return;
      if (i < 0 || i >= lines.length) return;
      if (prefetchRef.current.has(i)) return;
      prefetchRef.current.set(i, fetchCartesiaAudio(lines[i].text, lines[i].host));
    },
    [lines, ttsMode]
  );

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      if (audioRef.current.src) URL.revokeObjectURL(audioRef.current.src);
      audioRef.current = null;
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    stopAudio();
  }, [stopAudio]);

  const speakCartesia = useCallback(
    (start: number) => {
      cancelledRef.current = false;
      stopAudio();

      const speakNext = async (i: number) => {
        if (cancelledRef.current) return;
        if (i >= lines.length) {
          setStatus("ended");
          setIndex(Math.max(0, lines.length - 1));
          return;
        }

        indexRef.current = i;
        setIndex(i);
        setStatus("playing");

        prefetch(i + 1);

        const cached = prefetchRef.current.get(i);
        const url = cached ? await cached : await fetchCartesiaAudio(lines[i].text, lines[i].host);
        prefetchRef.current.delete(i);

        if (cancelledRef.current) {
          if (url) URL.revokeObjectURL(url);
          return;
        }

        if (!url) {
          speakNext(i + 1);
          return;
        }

        const audio = new Audio(url);
        audioRef.current = audio;
        audio.playbackRate = rateRef.current;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          if (!cancelledRef.current) speakNext(i + 1);
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          if (!cancelledRef.current) speakNext(i + 1);
        };
        audio.play().catch(() => {
          if (!cancelledRef.current) speakNext(i + 1);
        });
      };

      void speakNext(start);
    },
    [lines, stopAudio, prefetch]
  );

  const speakBrowser = useCallback(
    (start: number) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        setStatus("unsupported");
        return;
      }
      cancelledRef.current = false;
      stopSpeaking();
      const speakNext = (i: number) => {
        if (cancelledRef.current) return;
        if (i >= lines.length) {
          setStatus("ended");
          setIndex(Math.max(0, lines.length - 1));
          return;
        }
        const line = lines[i];
        indexRef.current = i;
        setIndex(i);
        setStatus("playing");
        const utter = new SpeechSynthesisUtterance(line.text);
        const maya = pickVoice(voicesRef.current, "maya");
        const jordan = pickVoice(voicesRef.current, "jordan", maya ?? undefined);
        utter.voice = (line.host === "maya" ? maya : jordan) ?? null;
        utter.rate = rateRef.current * (line.host === "maya" ? 1.02 : 0.97);
        utter.pitch = line.host === "maya" ? 1.12 : 0.88;
        utter.onend = () => {
          if (cancelledRef.current) return;
          speakNext(i + 1);
        };
        utter.onerror = () => {
          if (cancelledRef.current) return;
          speakNext(i + 1);
        };
        window.speechSynthesis.speak(utter);
      };
      speakNext(start);
    },
    [lines, stopSpeaking]
  );

  const speakFrom = useCallback(
    (start: number) => {
      if (ttsMode === "cartesia") {
        speakCartesia(start);
      } else {
        speakBrowser(start);
      }
    },
    [ttsMode, speakCartesia, speakBrowser]
  );

  const play = useCallback(() => {
    const start = status === "ended" ? 0 : indexRef.current;
    speakFrom(start);
  }, [speakFrom, status]);

  const pause = useCallback(() => {
    if (ttsMode === "cartesia") {
      audioRef.current?.pause();
      setStatus("paused");
    } else {
      if (typeof window !== "undefined") {
        window.speechSynthesis.pause();
        setStatus("paused");
      }
    }
  }, [ttsMode]);

  const resume = useCallback(() => {
    if (ttsMode === "cartesia") {
      if (audioRef.current) {
        audioRef.current.play().catch(() => speakFrom(indexRef.current));
        setStatus("playing");
      } else {
        speakFrom(indexRef.current);
      }
    } else {
      if (typeof window === "undefined") return;
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setStatus("playing");
        return;
      }
      speakFrom(indexRef.current);
    }
  }, [ttsMode, speakFrom]);

  const stop = useCallback(() => {
    cancelledRef.current = true;
    stopSpeaking();
    for (const [, promise] of prefetchRef.current) {
      void promise.then((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    }
    prefetchRef.current.clear();
    indexRef.current = 0;
    setIndex(0);
    setStatus("idle");
  }, [stopSpeaking]);

  const skip = useCallback(
    (delta: number) => {
      const next = Math.min(Math.max(indexRef.current + delta, 0), Math.max(lines.length - 1, 0));
      speakFrom(next);
    },
    [lines.length, speakFrom]
  );

  const jumpTo = useCallback(
    (i: number) => {
      speakFrom(i);
    },
    [speakFrom]
  );

  const changeRate = useCallback(
    (value: number) => {
      rateRef.current = value;
      setRate(value);
      if (ttsMode === "cartesia" && audioRef.current) {
        audioRef.current.playbackRate = value;
      }
    },
    [ttsMode]
  );

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      stopSpeaking();
      for (const [, promise] of prefetchRef.current) {
        void promise.then((url) => {
          if (url) URL.revokeObjectURL(url);
        });
      }
      prefetchRef.current.clear();
    };
  }, [stopSpeaking]);

  return {
    status,
    index,
    rate,
    voicesReady,
    voiceNames,
    ttsMode,
    play,
    pause,
    resume,
    stop,
    skip,
    jumpTo,
    changeRate,
  };
}
