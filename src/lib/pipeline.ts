import { benchmarkEpisode } from "./benchmark";
import { critiqueEpisode, repairScript, sourceSentencesFrom } from "./critique";
import { planEpisode } from "./episode-plan";
import { makeId } from "./text";
import {
  buildScriptPrompt,
  parseLlmScript,
  probeOllama,
  tryOllamaScript,
  type LlmScriptLine,
  type OllamaStatus,
} from "./ollama";
import { buildPaperModel, toExtractedPaper } from "./paper-model";
import { writeScript } from "./script";
import type {
  EngineInfo,
  EpisodeResult,
  ExtractedDoc,
  PipelineStage,
  PodcastScript,
  ScriptLine,
} from "./types";

export type ProduceOptions = {
  forceRules?: boolean;
  fetchImpl?: typeof fetch;
  ollamaBaseUrl?: string;
  onStage?: (stage: PipelineStage) => void;
};

function engineFrom(status: OllamaStatus, usedOllama: boolean): EngineInfo {
  if (usedOllama && status.available) {
    return {
      kind: "ollama",
      model: status.model,
      note: `This booth used Ollama (${status.model}) at localhost:11434. No paid API.`,
    };
  }
  if (status.available) {
    return {
      kind: "rules",
      model: status.model,
      note: `Ollama (${status.model}) is running, but the JSON pass failed a critique, so the rule writer shipped.`,
    };
  }
  return {
    kind: "rules",
    note: `${status.reason} The rule writer built PaperModel → EpisodePlan → Script instead. Start Ollama on localhost:11434 to try a local model.`,
  };
}

async function probeEngine(options: ProduceOptions): Promise<OllamaStatus> {
  if (options.forceRules) {
    return { available: false, reason: "Ollama skipped (forceRules)." };
  }
  if (options.fetchImpl || options.ollamaBaseUrl) {
    return probeOllama({
      fetchImpl: options.fetchImpl,
      baseUrl: options.ollamaBaseUrl,
    });
  }
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/ollama", { cache: "no-store" });
      return (await res.json()) as OllamaStatus;
    } catch {
      return { available: false, reason: "Ollama is not running at localhost:11434." };
    }
  }
  return probeOllama();
}

async function llmScriptLines(
  status: OllamaStatus,
  input: Parameters<typeof tryOllamaScript>[0],
  options: ProduceOptions
): Promise<LlmScriptLine[] | null> {
  if (!status.available) return null;
  if (typeof window !== "undefined" && !options.fetchImpl && !options.ollamaBaseUrl) {
    try {
      const res = await fetch("/api/ollama", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: buildScriptPrompt(input) }),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { json?: { lines?: LlmScriptLine[] } };
      return parseLlmScript(body.json ?? null);
    } catch {
      return null;
    }
  }
  return tryOllamaScript({ ...input, fetchImpl: options.fetchImpl, baseUrl: options.ollamaBaseUrl });
}

function scriptFromLlm(
  base: PodcastScript,
  llmLines: { host: "maya" | "jordan"; text: string; beatId: string; claimId?: string; quote?: string }[]
): PodcastScript {
  const lines: ScriptLine[] = llmLines.map((l) => ({
    id: makeId("line"),
    host: l.host,
    text: l.text,
    beatId: l.beatId,
    claimId: l.claimId,
    quote: l.quote,
  }));
  const wordCount = lines.reduce((n, l) => n + l.text.split(/\s+/).filter(Boolean).length, 0);
  return {
    ...base,
    lines,
    wordCount,
    estimatedSeconds: Math.max(45, Math.round((wordCount / 155) * 60)),
  };
}

export async function produceEpisode(
  docs: ExtractedDoc[],
  options: ProduceOptions = {}
): Promise<EpisodeResult> {
  const notify = (stage: PipelineStage) => options.onStage?.(stage);

  notify("extract");
  const papers = docs.map(toExtractedPaper);
  const sourceSentences = sourceSentencesFrom(papers);

  notify("model");
  const model = buildPaperModel(papers);

  notify("plan");
  const plan = planEpisode(model);

  const status = await probeEngine(options);

  notify("script");
  const ruleNote =
    status.available && status.model
      ? `Ollama (${status.model}) is on this machine, but this pass used the rule writer.`
      : "This booth used the rule writer because Ollama was not running.";
  let script = writeScript(model, plan, ruleNote);
  let usedOllama = false;

  if (status.available) {
    const llmLines = await llmScriptLines(
      status,
      {
        modelName: status.model,
        thesis: model.thesis,
        beats: plan.beats,
        claims: model.claims.map((c) => ({
          id: c.id,
          kind: c.kind,
          text: c.text,
          numbers: c.numbers,
        })),
      },
      options
    );
    if (llmLines) {
      const candidate = scriptFromLlm(script, llmLines);
      const llmCritique = critiqueEpisode(model, plan, candidate, sourceSentences);
      if (llmCritique.passed) {
        script = candidate;
        usedOllama = true;
      }
    }
  }

  notify("critique");
  let critique = critiqueEpisode(model, plan, script, sourceSentences);
  if (!critique.passed) {
    script = repairScript(model, plan, script, sourceSentences, critique);
    critique = critiqueEpisode(model, plan, script, sourceSentences);
  }

  const engine = engineFrom(status, usedOllama);
  if (engine.kind === "rules") {
    script = {
      ...script,
      lines: script.lines.map((l) =>
        /Thanks for listening/.test(l.text)
          ? { ...l, text: `${engine.note} If the voices sound like your operating system, that's because they are. Thanks for listening.` }
          : l
      ),
    };
  }

  script = {
    ...script,
    sources: papers.map((p) => ({ name: p.name, words: p.wordCount, pages: p.pages })),
  };

  notify("benchmark");
  const benchmark = benchmarkEpisode(model, plan, script, sourceSentences, engine.kind);

  return { papers, model, plan, script, critique, benchmark, engine };
}
