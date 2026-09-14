"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HostId, ScriptLine } from "@/lib/types";

export type PlayerStatus = "idle" | "playing" | "paused" | "ended" | "unsupported";

function voiceScore(voice: SpeechSynthesisVoice, host: HostId): number {
  const name = voice.name.toLowerCase();
  const lang = voice.lang.toLowerCase();
  let n = 0;
  if (lang.startsWith("en")) n += 5;
  if (lang.includes("us") || lang.includes("gb") || lang.includes("uk")) n += 1;
  if (host === "maya") {
    if (/female|samantha|victoria|karen|moira|zira|siri|google us english$|samantha/.test(name))
      n += 6;
    if (/male|david|daniel|fred|alex|george/.test(name)) n -= 3;
  } else {
    if (/male|david|daniel|fred|alex|george|daniel|microsoft david/.test(name)) n += 6;
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

export function useSpeechPlayer(lines: ScriptLine[]) {
  const [status, setStatus] = useState<PlayerStatus>("idle");
  const [index, setIndex] = useState(0);
  const [rate, setRate] = useState(1);
  const [voicesReady, setVoicesReady] = useState(false);
  const [voiceNames, setVoiceNames] = useState<{ maya?: string; jordan?: string }>({});
  const indexRef = useRef(0);
  const rateRef = useRef(1);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }
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
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
  }, []);

  const speakFrom = useCallback(
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

  const play = useCallback(() => {
    const start = status === "ended" ? 0 : indexRef.current;
    speakFrom(start);
  }, [speakFrom, status]);

  const pause = useCallback(() => {
    if (typeof window === "undefined") return;
    window.speechSynthesis.pause();
    setStatus("paused");
  }, []);

  const resume = useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setStatus("playing");
      return;
    }
    speakFrom(indexRef.current);
  }, [speakFrom]);

  const stop = useCallback(() => {
    cancelledRef.current = true;
    stopSpeaking();
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

  const changeRate = useCallback((value: number) => {
    rateRef.current = value;
    setRate(value);
  }, []);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      stopSpeaking();
    };
  }, [stopSpeaking]);

  return {
    status,
    index,
    rate,
    voicesReady,
    voiceNames,
    play,
    pause,
    resume,
    stop,
    skip,
    jumpTo,
    changeRate,
  };
}
