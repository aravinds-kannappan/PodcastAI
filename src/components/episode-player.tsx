"use client";

import { useEffect, useRef } from "react";
import {
  Download,
  Gauge,
  Mic2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Square,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { HOSTS, type PodcastScript } from "@/lib/types";
import { useSpeechPlayer } from "@/hooks/use-speech-player";

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function downloadScript(script: PodcastScript) {
  const body = [
    `${script.showTitle}: ${script.episodeTitle}`,
    script.logline,
    "",
    ...script.lines.map((line) => `${HOSTS[line.host].short}: ${line.text}`),
    "",
    "Takeaways:",
    ...script.takeaways.map((t, i) => `${i + 1}. ${t}`),
  ].join("\n");
  const blob = new Blob([body], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "PaperCast script.txt";
  a.click();
  URL.revokeObjectURL(url);
}

export function EpisodePlayer({ script }: { script: PodcastScript }) {
  const player = useSpeechPlayer(script.lines);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [player.index]);

  const progress =
    script.lines.length > 0 ? ((player.index + (player.status === "ended" ? 1 : 0)) / script.lines.length) * 100 : 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="rounded-2xl bg-foreground px-4 py-4 text-background sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium tracking-[0.18em] text-background/60 uppercase">
              Live booth
            </p>
            <h2 className="font-heading mt-1 text-lg leading-snug font-semibold text-balance sm:text-xl">
              {script.episodeTitle}
            </h2>
            <p className="mt-1 text-sm text-background/70">{script.logline}</p>
          </div>
          <Badge className="bg-background/15 text-background hover:bg-background/20">
            {formatClock(script.estimatedSeconds)}
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {(["maya", "jordan"] as const).map((id) => {
            const live =
              player.status === "playing" && script.lines[player.index]?.host === id;
            return (
              <div
                key={id}
                className={`rounded-xl border px-3 py-2.5 ${
                  live
                    ? "border-background/40 bg-background/15"
                    : "border-background/10 bg-background/5"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`size-2 rounded-full ${
                      id === "maya" ? "bg-orange-300" : "bg-teal-300"
                    } ${live ? "animate-pulse" : "opacity-50"}`}
                  />
                  <p className="text-sm font-medium">{HOSTS[id].name}</p>
                </div>
                <p className="text-xs text-background/55">
                  {HOSTS[id].role}
                  {player.voiceNames[id] ? ` · ${player.voiceNames[id]}` : ""}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-4 h-1 overflow-hidden rounded-full bg-background/15">
          <div
            className="h-full bg-orange-300 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {player.status === "unsupported" ? (
            <p className="text-sm text-background/80">
              This browser has no Web Speech API. Try Chrome or Edge. Playback is
              free and local.
            </p>
          ) : (
            <>
              <Button
                type="button"
                size="icon-lg"
                className="bg-background text-foreground hover:bg-background/90"
                onClick={() => {
                  if (player.status === "playing") player.pause();
                  else if (player.status === "paused") player.resume();
                  else player.play();
                }}
                aria-label={player.status === "playing" ? "Pause" : "Play episode"}
              >
                {player.status === "playing" ? <Pause /> : <Play />}
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="text-background hover:bg-background/10 hover:text-background"
                onClick={() => player.skip(-1)}
                aria-label="Previous line"
              >
                <SkipBack />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="text-background hover:bg-background/10 hover:text-background"
                onClick={() => player.skip(1)}
                aria-label="Next line"
              >
                <SkipForward />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="text-background hover:bg-background/10 hover:text-background"
                onClick={() => player.stop()}
                aria-label="Stop"
              >
                <Square />
              </Button>
              <Separator orientation="vertical" className="mx-1 h-6 bg-background/20" />
              <div className="flex min-w-36 flex-1 items-center gap-2">
                <Gauge className="size-3.5 text-background/60" />
                <Slider
                  min={0.8}
                  max={1.4}
                  step={0.1}
                  value={[player.rate]}
                  onValueChange={(v) => {
                    const next = Array.isArray(v) ? v[0] : v;
                    player.changeRate(typeof next === "number" ? next : 1);
                  }}
                  aria-label="Playback speed"
                  className="flex-1"
                />
                <span className="w-8 text-right text-xs tabular-nums text-background/70">
                  {player.rate.toFixed(1)}×
                </span>
              </div>
            </>
          )}
        </div>
        <p className="mt-3 text-xs text-background/50">
          Spoken with your browser’s voices via the Web Speech API. No TTS vendor,
          no key.
        </p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-sm font-medium">
          <Mic2 className="size-4 text-primary" />
          Script
        </p>
        <Button type="button" size="sm" variant="outline" onClick={() => downloadScript(script)}>
          <Download />
          Download script
        </Button>
      </div>

      <ScrollArea className="h-[min(28rem,55vh)] rounded-2xl border border-border bg-card">
        <ol className="flex flex-col gap-1 p-2 sm:p-3">
          {script.lines.map((line, i) => {
            const active = i === player.index && player.status !== "idle";
            return (
              <li key={line.id}>
                <button
                  type="button"
                  ref={active ? activeRef : undefined}
                  onClick={() => player.jumpTo(i)}
                  className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors ${
                    active ? "bg-accent" : "hover:bg-muted/70"
                  }`}
                >
                  <p
                    className={`text-[11px] font-semibold tracking-wide uppercase ${
                      line.host === "maya" ? "text-orange-800" : "text-teal-800"
                    }`}
                  >
                    {HOSTS[line.host].short}
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-pretty">{line.text}</p>
                  {line.quote ? (
                    <p className="mt-1 border-l-2 border-primary/30 pl-2 text-xs text-muted-foreground italic">
                      From the page: “{line.quote}”
                    </p>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ol>
      </ScrollArea>
    </div>
  );
}
