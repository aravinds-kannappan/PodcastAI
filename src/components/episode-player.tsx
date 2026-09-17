"use client";

import { useEffect, useRef, useState } from "react";
import {
  Download,
  Gauge,
  Hand,
  Loader2,
  MessageCircleQuestion,
  Mic2,
  Pause,
  Play,
  Send,
  SkipBack,
  SkipForward,
  Square,
  X,
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

export function EpisodePlayer({
  script,
  onActiveClaimId,
  onInterrupt,
  interruptBusy,
}: {
  script: PodcastScript;
  onActiveClaimId?: (id: string | null) => void;
  onInterrupt?: (question: string) => void;
  interruptBusy?: boolean;
}) {
  const player = useSpeechPlayer(script.lines);
  const activeRef = useRef<HTMLButtonElement>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [askText, setAskText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [player.index]);

  useEffect(() => {
    const line = script.lines[player.index];
    onActiveClaimId?.(line?.claimId ?? null);
  }, [player.index, script.lines, onActiveClaimId]);

  const progress =
    script.lines.length > 0
      ? ((player.index + (player.status === "ended" ? 1 : 0)) / script.lines.length) * 100
      : 0;

  function handleAskOpen() {
    if (player.status === "playing") player.pause();
    setAskOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleAskSubmit() {
    const q = askText.trim();
    if (!q || !onInterrupt) return;
    onInterrupt(q);
    setAskText("");
    setAskOpen(false);
  }

  function handleAskCancel() {
    setAskOpen(false);
    setAskText("");
    if (player.status === "paused") player.resume();
  }

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
              This browser has no Web Speech API. Try Chrome or Edge.
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

              {onInterrupt && (
                <>
                  <Separator orientation="vertical" className="mx-1 h-6 bg-background/20" />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-background hover:bg-background/10 hover:text-background"
                    onClick={handleAskOpen}
                    disabled={interruptBusy}
                    aria-label="Ask the hosts"
                  >
                    {interruptBusy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Hand className="size-3.5" />
                    )}
                    Ask the hosts
                  </Button>
                </>
              )}

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

        {askOpen && (
          <div className="mt-3 flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={askText}
              onChange={(e) => setAskText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAskSubmit();
                if (e.key === "Escape") handleAskCancel();
              }}
              placeholder="Ask the hosts anything about this paper…"
              className="flex-1 rounded-lg bg-background/10 px-3 py-2 text-sm text-background placeholder:text-background/40 focus:outline-none"
            />
            <Button
              type="button"
              size="icon"
              className="bg-orange-400 text-foreground hover:bg-orange-300"
              onClick={handleAskSubmit}
              disabled={!askText.trim()}
            >
              <Send className="size-3.5" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="text-background hover:bg-background/10 hover:text-background"
              onClick={handleAskCancel}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-sm font-medium">
          <Mic2 className="size-4 text-primary" />
          Script
          {script.lines.some((l) => l.id.startsWith("int")) && (
            <Badge variant="secondary" className="text-[10px]">
              <MessageCircleQuestion className="mr-1 size-3" />
              includes your questions
            </Badge>
          )}
        </p>
        <Button type="button" size="sm" variant="outline" onClick={() => downloadScript(script)}>
          <Download />
          Download
        </Button>
      </div>

      <ScrollArea className="h-[min(28rem,55vh)] rounded-2xl border border-border bg-card">
        <ol className="flex flex-col gap-1 p-2 sm:p-3">
          {script.lines.map((line, i) => {
            const active = i === player.index && player.status !== "idle";
            const isInterrupt = line.id.startsWith("int");
            return (
              <li key={line.id}>
                <button
                  type="button"
                  ref={active ? activeRef : undefined}
                  onClick={() => player.jumpTo(i)}
                  className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors ${
                    active
                      ? "bg-accent"
                      : isInterrupt
                        ? "bg-orange-50/50 hover:bg-orange-50"
                        : "hover:bg-muted/70"
                  }`}
                >
                  <p
                    className={`text-[11px] font-semibold tracking-wide uppercase ${
                      line.host === "maya" ? "text-orange-800" : "text-teal-800"
                    }`}
                  >
                    {HOSTS[line.host].short}
                    {isInterrupt && (
                      <span className="ml-1.5 text-[10px] font-normal normal-case text-muted-foreground">
                        (your question)
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-pretty">{line.text}</p>
                  {line.quote ? (
                    <p className="mt-1 border-l-2 border-primary/30 pl-2 text-xs text-muted-foreground italic">
                      From the page: &ldquo;{line.quote}&rdquo;
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
