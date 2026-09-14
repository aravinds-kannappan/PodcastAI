"use client";

import { Headphones, Loader2, Sparkles } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FileTray } from "@/components/file-tray";
import { EpisodePlayer } from "@/components/episode-player";
import { PipelineTrace } from "@/components/pipeline-trace";
import { EpisodeBriefing } from "@/components/episode-briefing";
import { ChoiceRow } from "@/components/choice-row";
import { LocalModelStatus, type OllamaUiStatus } from "@/components/local-model-status";
import type {
  EpisodeAudience,
  EpisodeLength,
  EpisodeOptions,
  EpisodeResult,
  EpisodeStyle,
  ExtractedDoc,
  PipelineStage,
  UploadItem,
} from "@/lib/types";
import {
  EPISODE_AUDIENCE_LABELS,
  EPISODE_LENGTH_LABELS,
  EPISODE_STYLE_LABELS,
} from "@/lib/types";

type Phase = "idle" | "loadingSamples" | "writing" | "ready";

export function Studio({
  items,
  result,
  stage,
  phase,
  error,
  options,
  ollama,
  reasoningLabel,
  voiceLabel,
  onItems,
  onDocs,
  onMakeEpisode,
  onLoadSamples,
  onOptions,
}: {
  items: UploadItem[];
  result: EpisodeResult | null;
  stage: PipelineStage | null;
  phase: Phase;
  error: string | null;
  options: EpisodeOptions;
  ollama: OllamaUiStatus;
  reasoningLabel: "ollama" | "rules" | "auto";
  voiceLabel: string;
  onItems: (items: UploadItem[]) => void;
  onDocs: (docs: ExtractedDoc[]) => void;
  onMakeEpisode: () => void;
  onLoadSamples: () => void;
  onOptions: (options: EpisodeOptions) => void;
}) {
  const busy = phase === "writing" || phase === "loadingSamples";
  const readyCount = items.filter((i) => i.status === "ready").length;
  const script = result?.script ?? null;

  return (
    <div className="flex flex-col gap-8">
      <section className="max-w-2xl">
        <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">Free listening booth</p>
        <h1 className="font-heading mt-2 text-3xl leading-[1.15] font-semibold tracking-tight text-balance sm:text-4xl">
          Model the paper. Then write the show.
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground text-pretty">
          PaperCast extracts a document in the browser, builds a PaperModel of claims and evidence,
          plans the episode, writes Maya and Jordan from that plan, then critiques and scores the
          result. It will not generate dialogue from raw extracted sentences. No OpenAI, no cloud
          TTS, no keys.
        </p>
      </section>

      <LocalModelStatus ollama={ollama} reasoning={reasoningLabel} voice={voiceLabel} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
        <section className="flex flex-col gap-4">
          <FileTray
            items={items}
            busy={busy}
            onChange={(next) => onItems(next)}
            onExtracted={onDocs}
          />

          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
            <ChoiceRow
              label="Style"
              value={options.style}
              disabled={busy}
              onChange={(style: EpisodeStyle) => onOptions({ ...options, style })}
              options={(Object.keys(EPISODE_STYLE_LABELS) as EpisodeStyle[]).map((id) => ({
                id,
                label: EPISODE_STYLE_LABELS[id],
              }))}
            />
            <ChoiceRow
              label="Length"
              value={options.length}
              disabled={busy}
              onChange={(length: EpisodeLength) => onOptions({ ...options, length })}
              options={(Object.keys(EPISODE_LENGTH_LABELS) as EpisodeLength[]).map((id) => ({
                id,
                label: EPISODE_LENGTH_LABELS[id],
              }))}
            />
            <ChoiceRow
              label="Audience"
              value={options.audience}
              disabled={busy}
              onChange={(audience: EpisodeAudience) => onOptions({ ...options, audience })}
              options={(Object.keys(EPISODE_AUDIENCE_LABELS) as EpisodeAudience[]).map((id) => ({
                id,
                label: EPISODE_AUDIENCE_LABELS[id],
              }))}
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              size="lg"
              className="flex-1"
              disabled={busy || readyCount === 0}
              onClick={onMakeEpisode}
            >
              {phase === "writing" ? <Loader2 className="animate-spin" /> : <Headphones />}
              {phase === "writing" ? "Writing from the plan…" : "Make episode"}
            </Button>
            <Button type="button" size="lg" variant="outline" disabled={busy} onClick={onLoadSamples}>
              {phase === "loadingSamples" ? <Loader2 className="animate-spin" /> : <Sparkles />}
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
            If Ollama is running locally, PaperCast will try it for the script and keep the pass only
            if critique still finds no extractive leak. Otherwise the rule writer runs entirely in
            this tab. Open Benchmark to score the same loop with an Ollama or rule-based judge.
          </p>
        </section>

        <section className="min-h-80">
          {script && phase === "ready" && result ? (
            <EpisodeBriefing
              result={result}
              scriptSlot={
                <EpisodePlayer key={`${script.episodeTitle}-${script.wordCount}`} script={script} />
              }
            />
          ) : (
            <EmptyBooth loading={busy} stage={stage} />
          )}
        </section>
      </div>
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
            Drop a paper, pick a style, or load the sample stack, then press Make episode. After it
            writes, switch among script, takeaways, claims, evidence, and limitations.
          </p>
        </>
      )}
    </div>
  );
}
