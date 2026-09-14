"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Radio } from "lucide-react";
import { BenchmarkTab } from "@/components/benchmark-tab";
import { LocalModelsTab } from "@/components/local-models-tab";
import { Studio } from "@/components/studio";
import type { OllamaUiStatus } from "@/components/local-model-status";
import { extractDocument } from "@/lib/extract";
import { produceEpisode } from "@/lib/pipeline";
import { fetchSampleFiles } from "@/lib/samples";
import { browserSpeechProvider } from "@/lib/tts/browser-provider";
import { ttsProviders } from "@/lib/tts";
import type {
  BenchmarkResult,
  EpisodeOptions,
  EpisodeResult,
  ExtractedDoc,
  JudgeKind,
  PipelineStage,
  UploadItem,
} from "@/lib/types";
import { DEFAULT_EPISODE_OPTIONS } from "@/lib/types";

type TabId = "studio" | "benchmark" | "models";
type Phase = "idle" | "loadingSamples" | "writing" | "ready";

const TABS: { id: TabId; label: string }[] = [
  { id: "studio", label: "Studio" },
  { id: "benchmark", label: "Benchmark" },
  { id: "models", label: "Local Models" },
];

export function AppShell() {
  const [tab, setTab] = useState<TabId>("studio");
  const [items, setItems] = useState<UploadItem[]>([]);
  const [docs, setDocs] = useState<ExtractedDoc[]>([]);
  const [result, setResult] = useState<EpisodeResult | null>(null);
  const [stage, setStage] = useState<PipelineStage | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<EpisodeOptions>(DEFAULT_EPISODE_OPTIONS);
  const [ollama, setOllama] = useState<OllamaUiStatus>({ state: "checking" });
  const [preferredModel, setPreferredModel] = useState<string | undefined>();
  const [judge, setJudge] = useState<JudgeKind>("rules");
  const [judgeModel, setJudgeModel] = useState<string | undefined>();
  const [evaluation, setEvaluation] = useState<BenchmarkResult | null>(null);
  const [benchBusy, setBenchBusy] = useState(false);
  const [benchError, setBenchError] = useState<string | null>(null);
  const [browserVoice, setBrowserVoice] = useState(false);
  const autoJudge = useRef(false);

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
        setJudgeModel((prev) => prev ?? body.model);
        if (!autoJudge.current) {
          autoJudge.current = true;
          setJudge("ollama");
        }
      } else {
        setOllama({
          state: "unavailable",
          reason: body.reason ?? "Ollama is not running at localhost:11434.",
        });
      }
    } catch {
      setOllama({
        state: "unavailable",
        reason: "Ollama is not running at localhost:11434.",
      });
    }
  }, []);

  useEffect(() => {
    const kick = window.setTimeout(() => {
      void refreshOllama();
    }, 0);
    const t = window.setInterval(() => {
      void refreshOllama();
    }, 20000);
    return () => {
      window.clearTimeout(kick);
      window.clearInterval(t);
    };
  }, [refreshOllama]);

  useEffect(() => {
    void browserSpeechProvider.available().then(setBrowserVoice);
  }, []);

  async function ingestFiles(files: File[]): Promise<ExtractedDoc[]> {
    const uploads: UploadItem[] = files.map((file) => ({
      id: globalThis.crypto.randomUUID(),
      file,
      status: "queued",
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
    return extracted;
  }

  async function makeEpisode(fromDocs = docs) {
    setError(null);
    if (!fromDocs.length) {
      setError("Add a readable file first. PDF, Markdown, or plain text is enough.");
      return;
    }
    setPhase("writing");
    setStage("extract");
    setResult(null);
    try {
      const next = await produceEpisode(fromDocs, {
        onStage: setStage,
        episode: options,
        preferredModel,
        judge: "rules",
        forceRules: ollama.state !== "connected",
      });
      setResult(next);
      setEvaluation(next.evaluation);
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
      const extracted = await ingestFiles(files);
      await makeEpisode(extracted);
    } catch (err) {
      setPhase("idle");
      setStage(null);
      setError(
        err instanceof Error
          ? err.message
          : "Could not load the sample stack. Try uploading your own files."
      );
    }
  }

  async function runBenchmark(fromDocs: ExtractedDoc[]) {
    setBenchError(null);
    if (!fromDocs.length) {
      setBenchError("Add a readable file first, or run the sample benchmark.");
      return;
    }
    setBenchBusy(true);
    setEvaluation(null);
    try {
      const useOllama = judge === "ollama" && ollama.state === "connected";
      const res = await fetch("/api/benchmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docs: fromDocs,
          options,
          judge: useOllama ? "ollama" : "rules",
          judgeModel: useOllama ? judgeModel ?? preferredModel : undefined,
          preferredModel,
          forceRules: !useOllama && ollama.state !== "connected",
        }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        reason?: string;
        evaluation?: BenchmarkResult;
      };
      if (!res.ok || !body.ok || !body.evaluation) {
        const local = await produceEpisode(fromDocs, {
          episode: options,
          preferredModel,
          judge: useOllama ? "ollama" : "rules",
          judgeModel: judgeModel ?? preferredModel,
          forceRules: !useOllama,
        });
        setEvaluation(local.evaluation);
        setResult(local);
        return;
      }
      setEvaluation(body.evaluation);
    } catch (err) {
      try {
        const local = await produceEpisode(fromDocs, {
          episode: options,
          preferredModel,
          judge: "rules",
          forceRules: true,
        });
        setEvaluation(local.evaluation);
        setResult(local);
      } catch {
        setBenchError(err instanceof Error ? err.message : "Could not run the benchmark.");
      }
    } finally {
      setBenchBusy(false);
    }
  }

  async function runSampleBenchmark() {
    setBenchBusy(true);
    setBenchError(null);
    try {
      const files = await fetchSampleFiles();
      const extracted: ExtractedDoc[] = [];
      for (const file of files) {
        extracted.push(await extractDocument(file, globalThis.crypto.randomUUID()));
      }
      setDocs(extracted);
      setItems(
        files.map((file, i) => ({
          id: extracted[i].id,
          file,
          status: "ready" as const,
          doc: extracted[i],
        }))
      );
      await runBenchmark(extracted);
    } catch (err) {
      setBenchBusy(false);
      setBenchError(err instanceof Error ? err.message : "Could not load sample documents.");
    }
  }

  const voiceRows = ttsProviders.map((p) => ({
    id: p.id,
    label: p.label,
    available: p.id === "browser-speech" ? browserVoice : false,
    note:
      p.id === "browser-speech"
        ? "Web Speech API in this browser. Maya and Jordan use system voices."
        : p.id === "piper"
          ? "Local neural TTS. Not wired yet."
          : p.id === "macos-say"
            ? "macOS `say`. Detected later; not required."
            : "Coqui / local neural TTS. Planned stub.",
  }));

  const reasoningNow: "ollama" | "rules" | "auto" =
    result?.engine.kind ?? (ollama.state === "connected" ? "auto" : "rules");

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border/80 bg-card/70 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Radio className="size-4" />
              </span>
              <div>
                <p className="font-heading text-base leading-none font-semibold tracking-tight">PaperCast</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">PaperModel to podcast, on the house</p>
              </div>
            </div>
            <p className="hidden max-w-xs text-right text-xs text-muted-foreground sm:block">
              Local only. Ollama optional at localhost:11434. Voices come from this browser.
            </p>
          </div>
          <nav className="flex gap-1 overflow-x-auto" aria-label="Main">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap ${
                  tab === t.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-10">
        {tab === "studio" ? (
          <Studio
            items={items}
            result={result}
            stage={stage}
            phase={phase}
            error={error}
            options={options}
            ollama={ollama}
            reasoningLabel={reasoningNow}
            voiceLabel={browserVoice ? "Browser SpeechSynthesis" : "No browser voices"}
            onItems={(next) => {
              setItems(next);
              setResult(null);
              setStage(null);
              setPhase("idle");
            }}
            onDocs={setDocs}
            onMakeEpisode={() => void makeEpisode()}
            onLoadSamples={() => void loadSamples()}
            onOptions={setOptions}
          />
        ) : null}
        {tab === "benchmark" ? (
          <BenchmarkTab
            ollama={ollama}
            docs={docs}
            judge={judge}
            judgeModel={judgeModel}
            onJudgeChange={setJudge}
            onJudgeModelChange={setJudgeModel}
            result={evaluation}
            busy={benchBusy}
            error={benchError}
            onRunSamples={() => void runSampleBenchmark()}
            onRunCurrent={() => void runBenchmark(docs)}
          />
        ) : null}
        {tab === "models" ? (
          <LocalModelsTab
            ollama={ollama}
            reasoning={reasoningNow}
            preferredModel={preferredModel}
            onPreferredModel={setPreferredModel}
            voiceRows={voiceRows}
          />
        ) : null}
      </main>
    </div>
  );
}
