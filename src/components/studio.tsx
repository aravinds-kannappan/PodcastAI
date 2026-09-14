"use client";

import { useState } from "react";
import { Headphones, Loader2, Radio, Sparkles } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FileTray } from "@/components/file-tray";
import { EpisodePlayer } from "@/components/episode-player";
import { PipelineTrace } from "@/components/pipeline-trace";
import { extractDocument } from "@/lib/extract";
import { produceEpisode } from "@/lib/pipeline";
import type { EpisodeResult, ExtractedDoc, PipelineStage, UploadItem } from "@/lib/types";

const SAMPLES = [
  {
    path: "/samples/CivicAttention.pdf",
    name: "CivicAttention.pdf",
    type: "application/pdf",
  },
  {
    path: "/samples/SourdoughNotes.md",
    name: "SourdoughNotes.md",
    type: "text/markdown",
  },
  {
    path: "/samples/QuietHourMemo.txt",
    name: "QuietHourMemo.txt",
    type: "text/plain",
  },
];

type Phase = "idle" | "loadingSamples" | "writing" | "ready";

export function Studio() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [docs, setDocs] = useState<ExtractedDoc[]>([]);
  const [result, setResult] = useState<EpisodeResult | null>(null);
  const [stage, setStage] = useState<PipelineStage | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  const busy = phase === "writing" || phase === "loadingSamples";
  const readyCount = items.filter((i) => i.status === "ready").length;
  const script = result?.script ?? null;

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
      const next = await produceEpisode(fromDocs, { onStage: setStage });
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
      const files: File[] = [];
      for (const sample of SAMPLES) {
        const res = await fetch(sample.path);
        if (!res.ok) throw new Error(`Missing sample ${sample.name}`);
        const blob = await res.blob();
        files.push(new File([blob], sample.name, { type: sample.type }));
      }
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

  return (
    <div className="flex min-h-full flex-1 flex-col">
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
                PaperModel to podcast, on the house
              </p>
            </div>
          </div>
          <p className="hidden max-w-xs text-right text-xs text-muted-foreground sm:block">
            Local only. Ollama optional at localhost:11434. Voices come from this browser.
          </p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
        <section className="max-w-2xl">
          <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">
            Free listening booth
          </p>
          <h1 className="font-heading mt-2 text-3xl leading-[1.15] font-semibold tracking-tight text-balance sm:text-4xl">
            Model the paper. Then write the show.
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground text-pretty">
            PaperCast extracts a document in the browser, builds a PaperModel of
            claims and evidence, plans the episode, writes Maya and Jordan from
            that plan, then critiques and scores the result. It will not generate
            dialogue from raw extracted sentences. No OpenAI, no cloud TTS, no keys.
          </p>
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
          <section className="flex flex-col gap-4">
            <FileTray
              items={items}
              busy={busy}
              onChange={(next) => {
                setItems(next);
                setResult(null);
                setStage(null);
                setPhase("idle");
              }}
              onExtracted={(next) => {
                setDocs(next);
              }}
            />

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                size="lg"
                className="flex-1"
                disabled={busy || readyCount === 0}
                onClick={() => void makeEpisode()}
              >
                {phase === "writing" ? <Loader2 className="animate-spin" /> : <Headphones />}
                {phase === "writing" ? "Writing from the plan…" : "Make episode"}
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
                Load sample stack
              </Button>
            </div>

            <PipelineTrace result={result} stage={stage} busy={busy} />

            {error ? (
              <Alert variant="destructive">
                <AlertTitle>The booth stalled</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <p className="text-xs leading-relaxed text-muted-foreground">
              If Ollama is running locally, PaperCast will try it for the script
              and keep the pass only if critique still finds no extractive leak.
              Otherwise the rule writer runs entirely in this tab.
            </p>
          </section>

          <section className="min-h-80">
            {script && phase === "ready" ? (
              <EpisodePlayer
                key={`${script.episodeTitle}-${script.wordCount}`}
                script={script}
              />
            ) : (
              <EmptyBooth loading={busy} stage={stage} />
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function EmptyBooth({
  loading,
  stage,
}: {
  loading: boolean;
  stage: PipelineStage | null;
}) {
  return (
    <div className="flex h-full min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
      {loading ? (
        <>
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="font-heading mt-4 text-lg font-semibold">Warming up the booth</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {stage === "model"
              ? "Turning the extracted paper into claims."
              : stage === "plan"
                ? "Planning beats from those claims."
                : stage === "script"
                  ? "Writing the conversation from the plan."
                  : stage === "critique" || stage === "benchmark"
                    ? "Scoring the episode before it hits the player."
                    : "Reading files, then running the PaperModel loop."}
          </p>
        </>
      ) : (
        <>
          <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Headphones className="size-6" />
          </span>
          <p className="font-heading mt-4 text-lg font-semibold">No episode yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Drop a paper, or load the sample stack (a research PDF plus two
            kitchen science notes), then press Make episode.
          </p>
        </>
      )}
    </div>
  );
}
