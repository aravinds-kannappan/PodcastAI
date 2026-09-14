"use client";

import { useState } from "react";
import { Headphones, Loader2, Radio, Sparkles } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FileTray } from "@/components/file-tray";
import { EpisodePlayer } from "@/components/episode-player";
import { extractDocument } from "@/lib/extract";
import { generatePodcast } from "@/lib/podcast";
import type { ExtractedDoc, PodcastScript, UploadItem } from "@/lib/types";

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
  const [script, setScript] = useState<PodcastScript | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  const busy = phase === "writing" || phase === "loadingSamples";
  const readyCount = items.filter((i) => i.status === "ready").length;

  async function makeEpisode(fromDocs = docs) {
    setError(null);
    if (!fromDocs.length) {
      setError("Add a readable file first. PDF, Markdown, or plain text is enough.");
      return;
    }
    setPhase("writing");
    await new Promise((r) => setTimeout(r, 280));
    try {
      const next = generatePodcast(fromDocs);
      setScript(next);
      setPhase("ready");
    } catch (err) {
      setScript(null);
      setPhase("idle");
      setError(err instanceof Error ? err.message : "Could not write the episode.");
    }
  }

  async function loadSamples() {
    setError(null);
    setPhase("loadingSamples");
    setScript(null);
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
                Paper to podcast, on the house
              </p>
            </div>
          </div>
          <p className="hidden text-xs text-muted-foreground sm:block">
            No accounts. No Speechify bill. Voices come from this browser.
          </p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-6 sm:px-6 sm:py-10">
        <section className="max-w-2xl">
          <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">
            Free listening booth
          </p>
          <h1 className="font-heading mt-2 text-3xl leading-[1.15] font-semibold tracking-tight text-balance sm:text-4xl">
            Put a paper in. Get a two host show out.
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground text-pretty">
            PaperCast is a free local stand in for Speechify’s paper to podcast
            trick. It extracts the text locally, writes a Maya and Jordan
            conversation from the claims on the page, and reads it aloud with
            the Web Speech API. No OpenAI, no cloud TTS, no keys.
          </p>
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
          <section className="flex flex-col gap-4">
            <FileTray
              items={items}
              busy={busy}
              onChange={(next) => {
                setItems(next);
                setScript(null);
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
                {phase === "writing" ? "Writing the episode…" : "Make episode"}
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

            {phase === "writing" ? (
              <Alert>
                <AlertTitle>Marking up the claims</AlertTitle>
                <AlertDescription>
                  PaperCast is picking the important sentences and turning them
                  into a conversation. No remote model in the loop.
                </AlertDescription>
              </Alert>
            ) : null}

            {error ? (
              <Alert variant="destructive">
                <AlertTitle>The booth stalled</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <p className="text-xs leading-relaxed text-muted-foreground">
              The script is extractive: hosts quote and rephrase the document
              instead of inventing citations. Good enough to listen while you
              cook. Not a substitute for reading a paper you have to review.
            </p>
          </section>

          <section className="min-h-80">
            {script && phase === "ready" ? (
              <EpisodePlayer
                key={`${script.episodeTitle}-${script.wordCount}`}
                script={script}
              />
            ) : (
              <EmptyBooth loading={busy} />
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function EmptyBooth({ loading }: { loading: boolean }) {
  return (
    <div className="flex h-full min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
      {loading ? (
        <>
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="font-heading mt-4 text-lg font-semibold">
            Warming up the booth
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Reading files, then writing Maya and Jordan’s rundown.
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
