"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Radio, Settings2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentInput } from "@/components/content-input";
import { ChoiceRow } from "@/components/choice-row";
import { EpisodePlayer } from "@/components/episode-player";
import { SourceViewer } from "@/components/source-viewer";
import type { OllamaUiStatus } from "@/components/local-model-status";
import { extractDocument } from "@/lib/extract";
import { generateInterrupt } from "@/lib/interrupt";
import { produceEpisode } from "@/lib/pipeline";
import { fetchSampleFiles } from "@/lib/samples";
import type {
  EpisodeAudience,
  EpisodeLength,
  EpisodeOptions,
  EpisodeResult,
  EpisodeStyle,
  ExtractedDoc,
  PipelineStage,
  ScriptLine,
  UploadItem,
} from "@/lib/types";
import {
  DEFAULT_EPISODE_OPTIONS,
  EPISODE_AUDIENCE_LABELS,
  EPISODE_LENGTH_LABELS,
  EPISODE_STYLE_LABELS,
} from "@/lib/types";

type Phase = "idle" | "loadingSamples" | "writing" | "ready";

export function AppShell() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [docs, setDocs] = useState<ExtractedDoc[]>([]);
  const [result, setResult] = useState<EpisodeResult | null>(null);
  const [stage, setStage] = useState<PipelineStage | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<EpisodeOptions>(DEFAULT_EPISODE_OPTIONS);
  const [ollama, setOllama] = useState<OllamaUiStatus>({ state: "checking" });
  const [preferredModel, setPreferredModel] = useState<string | undefined>();
  const [activeClaimId, setActiveClaimId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [interruptBusy, setInterruptBusy] = useState(false);
  const [activeLines, setActiveLines] = useState<ScriptLine[]>([]);
  const [activeScript, setActiveScript] = useState(result?.script ?? null);
  const [cartesiaAvailable, setCartesiaAvailable] = useState(false);
  const interruptIndex = useRef(0);

  const refreshOllama = useCallback(async () => {
    try {
      const res = await fetch("/api/ollama/tags", { cache: "no-store" });
      const body = (await res.json()) as {
        available?: boolean;
        model?: string;
        models?: string[];
        reason?: string;
      };
      if (body.available && body.model) {
        setOllama({ state: "connected", model: body.model, models: body.models ?? [] });
        setPreferredModel((prev) => prev ?? body.model);
      } else {
        setOllama({
          state: "unavailable",
          reason: body.reason ?? "Ollama is not running.",
        });
      }
    } catch {
      setOllama({ state: "unavailable", reason: "Ollama is not running." });
    }
  }, []);

  useEffect(() => {
    const kick = window.setTimeout(() => void refreshOllama(), 0);
    const t = window.setInterval(() => void refreshOllama(), 20000);
    return () => {
      window.clearTimeout(kick);
      window.clearInterval(t);
    };
  }, [refreshOllama]);

  useEffect(() => {
    fetch("/api/tts")
      .then((r) => r.json())
      .then((b: { available?: boolean }) => setCartesiaAvailable(!!b.available))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (result?.script) {
      setActiveLines(result.script.lines);
      setActiveScript(result.script);
    }
  }, [result]);

  const busy = phase === "writing" || phase === "loadingSamples";
  const readyCount = items.filter((i) => i.status === "ready").length;

  async function makeEpisode(fromDocs = docs) {
    setError(null);
    if (!fromDocs.length) {
      setError("Add some content first — upload a file, paste text, or enter a URL.");
      return;
    }
    setPhase("writing");
    setStage("extract");
    setResult(null);
    setActiveClaimId(null);
    try {
      const next = await produceEpisode(fromDocs, {
        onStage: setStage,
        episode: options,
        preferredModel,
        judge: "rules",
        forceRules: ollama.state !== "connected",
      });
      setResult(next);
      setStage(null);
      setPhase("ready");
    } catch (err) {
      setResult(null);
      setStage(null);
      setPhase("idle");
      setError(err instanceof Error ? err.message : "Could not write the episode.");
    }
  }

  async function loadSamples() {
    setError(null);
    setPhase("loadingSamples");
    setResult(null);
    setStage("extract");
    try {
      const files = await fetchSampleFiles();
      const uploads: UploadItem[] = files.map((file) => ({
        id: globalThis.crypto.randomUUID(),
        file,
        status: "queued" as const,
      }));
      setItems(uploads);
      const extracted: ExtractedDoc[] = [];
      const working = [...uploads];
      for (let i = 0; i < working.length; i++) {
        working[i] = { ...working[i], status: "reading" };
        setItems([...working]);
        const doc = await extractDocument(working[i].file, working[i].id);
        working[i] = { ...working[i], status: "ready", doc };
        extracted.push(doc);
        setItems([...working]);
      }
      setDocs(extracted);
      await makeEpisode(extracted);
    } catch (err) {
      setPhase("idle");
      setStage(null);
      setError(
        err instanceof Error ? err.message : "Could not load samples."
      );
    }
  }

  async function handleInterrupt(question: string) {
    if (!result) return;
    setInterruptBusy(true);
    try {
      const currentIdx = interruptIndex.current;
      const recentLines = activeLines.slice(Math.max(0, currentIdx - 3), currentIdx + 1);
      const response = await generateInterrupt(
        { question, model: result.model, recentLines },
        {
          ollamaAvailable: ollama.state === "connected",
          preferredModel,
        }
      );
      const newLines = [
        ...activeLines.slice(0, currentIdx + 1),
        ...response,
        ...activeLines.slice(currentIdx + 1),
      ];
      setActiveLines(newLines);
      setActiveScript((prev) =>
        prev
          ? { ...prev, lines: newLines, wordCount: newLines.reduce((n, l) => n + l.text.split(/\s+/).length, 0) }
          : prev
      );
    } catch {
      setError("Could not generate a response. Try again.");
    } finally {
      setInterruptBusy(false);
    }
  }

  const handleActiveClaimId = useCallback((id: string | null) => {
    setActiveClaimId(id);
  }, []);

  const stageLabel =
    stage === "model"
      ? "Building the paper model…"
      : stage === "plan"
        ? "Planning the episode…"
        : stage === "script"
          ? "Writing the conversation…"
          : stage === "critique" || stage === "benchmark"
            ? "Scoring and reviewing…"
            : "Reading your content…";

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <header className="border-b border-border/80 bg-card/70 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Radio className="size-4" />
            </span>
            <div>
              <p className="font-heading text-base leading-none font-semibold tracking-tight">
                PaperCast
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Drop it in. Hear it back.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`size-2 rounded-full ${
                ollama.state === "connected" ? "bg-emerald-400" : "bg-muted-foreground/40"
              }`}
              title={
                ollama.state === "connected"
                  ? `Ollama: ${ollama.model}`
                  : "Ollama not connected"
              }
            />
            <span className="text-xs text-muted-foreground">
              {ollama.state === "connected" ? ollama.model : "Rule-based"}
            </span>
            {phase === "ready" && (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={() => setShowSettings(!showSettings)}
              >
                <Settings2 className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
        {phase === "ready" && result && activeScript ? (
          /* ===== PLAYBACK MODE ===== */
          <div className="flex flex-1 flex-col gap-6">
            {showSettings && (
              <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-border bg-card p-4">
                <ChoiceRow
                  label="Style"
                  value={options.style}
                  disabled={busy}
                  onChange={(style: EpisodeStyle) => setOptions({ ...options, style })}
                  options={(Object.keys(EPISODE_STYLE_LABELS) as EpisodeStyle[]).map((id) => ({
                    id,
                    label: EPISODE_STYLE_LABELS[id],
                  }))}
                />
                <ChoiceRow
                  label="Length"
                  value={options.length}
                  disabled={busy}
                  onChange={(length: EpisodeLength) => setOptions({ ...options, length })}
                  options={(Object.keys(EPISODE_LENGTH_LABELS) as EpisodeLength[]).map((id) => ({
                    id,
                    label: EPISODE_LENGTH_LABELS[id],
                  }))}
                />
                <ChoiceRow
                  label="Audience"
                  value={options.audience}
                  disabled={busy}
                  onChange={(audience: EpisodeAudience) => setOptions({ ...options, audience })}
                  options={(Object.keys(EPISODE_AUDIENCE_LABELS) as EpisodeAudience[]).map((id) => ({
                    id,
                    label: EPISODE_AUDIENCE_LABELS[id],
                  }))}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setShowSettings(false);
                    void makeEpisode();
                  }}
                >
                  Regenerate
                </Button>
              </div>
            )}

            <div className="grid flex-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              {/* Source viewer */}
              <div className="h-[min(38rem,70vh)] rounded-2xl border border-border bg-card">
                <SourceViewer
                  papers={result.papers}
                  claims={result.model.claims}
                  activeClaimId={activeClaimId}
                />
              </div>

              {/* Player */}
              <EpisodePlayer
                key={activeScript.lines.length}
                script={activeScript}
                onActiveClaimId={handleActiveClaimId}
                onInterrupt={(q) => void handleInterrupt(q)}
                interruptBusy={interruptBusy}
              />
            </div>

            <div className="flex items-center justify-between">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setPhase("idle");
                  setResult(null);
                  setActiveLines([]);
                  setActiveScript(null);
                  setActiveClaimId(null);
                  setItems([]);
                  setDocs([]);
                }}
              >
                New episode
              </Button>
              <p className="text-xs text-muted-foreground">
                {result.engine.kind === "ollama"
                  ? `Written with ${result.engine.model ?? "Ollama"}`
                  : "Written with the rule-based engine"}
                {" · "}
                {activeScript.wordCount.toLocaleString()} words
                {" · "}
                {cartesiaAvailable ? "Cartesia Sonic-2 voices" : "Voices from your browser"}
              </p>
            </div>
          </div>
        ) : (
          /* ===== INPUT MODE ===== */
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
            <section>
              <h1 className="font-heading text-3xl leading-[1.15] font-semibold tracking-tight text-balance sm:text-4xl">
                Drop it in. Hear it back.
              </h1>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground text-pretty">
                Turn any article, paper, or notes into a two-host podcast — free and open
                source. Upload a file, paste text, or enter a URL.
              </p>
            </section>

            <ContentInput
              items={items}
              busy={busy}
              onChange={(next) => {
                setItems(next);
                setResult(null);
                setStage(null);
              }}
              onExtracted={setDocs}
            />

            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
              <ChoiceRow
                label="Style"
                value={options.style}
                disabled={busy}
                onChange={(style: EpisodeStyle) => setOptions({ ...options, style })}
                options={(Object.keys(EPISODE_STYLE_LABELS) as EpisodeStyle[]).map((id) => ({
                  id,
                  label: EPISODE_STYLE_LABELS[id],
                }))}
              />
              <ChoiceRow
                label="Length"
                value={options.length}
                disabled={busy}
                onChange={(length: EpisodeLength) => setOptions({ ...options, length })}
                options={(Object.keys(EPISODE_LENGTH_LABELS) as EpisodeLength[]).map((id) => ({
                  id,
                  label: EPISODE_LENGTH_LABELS[id],
                }))}
              />
              <ChoiceRow
                label="Audience"
                value={options.audience}
                disabled={busy}
                onChange={(audience: EpisodeAudience) => setOptions({ ...options, audience })}
                options={(Object.keys(EPISODE_AUDIENCE_LABELS) as EpisodeAudience[]).map(
                  (id) => ({ id, label: EPISODE_AUDIENCE_LABELS[id] })
                )}
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                size="lg"
                className="flex-1"
                disabled={busy || readyCount === 0}
                onClick={() => void makeEpisode()}
              >
                {phase === "writing" ? <Loader2 className="animate-spin" /> : <Radio />}
                {phase === "writing" ? stageLabel : "Make episode"}
              </Button>
              <Button
                type="button"
                size="lg"
                variant="outline"
                disabled={busy}
                onClick={() => void loadSamples()}
              >
                {phase === "loadingSamples" ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Sparkles />
                )}
                Try a sample
              </Button>
            </div>

            {error && (
              <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </p>
            )}

            <p className="text-xs leading-relaxed text-muted-foreground">
              Everything runs in your browser and on your machine.
              {ollama.state === "connected"
                ? ` Ollama (${ollama.model}) will write the script.`
                : " Start Ollama on localhost:11434 for a local LLM boost, or the rule writer handles it."}
              {" "}No cloud API, no keys, no data leaves this tab.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
