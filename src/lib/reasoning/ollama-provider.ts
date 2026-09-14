import { ollamaJson, parseLlmScript, probeOllama, type LlmScriptLine } from "@/lib/ollama";
import { planEpisode } from "@/lib/episode-plan";
import { writeScript } from "@/lib/script";
import { critiqueScriptResult } from "@/lib/script-critic";
import { makeId } from "@/lib/text";
import type {
  EpisodeOptions,
  ExtractedPaper,
  PaperModel,
  EpisodePlan,
  PodcastScript,
  ScriptLine,
  ScriptCritiqueResult,
  ScriptIssue,
  ScriptScores,
} from "@/lib/types";
import { DEFAULT_EPISODE_OPTIONS } from "@/lib/types";
import type { ReasoningProvider } from "./types";
import { ruleBasedReasoning } from "./rule-based-provider";

export class OllamaReasoningProvider implements ReasoningProvider {
  id = "ollama";
  label = "Ollama (localhost:11434)";
  model?: string;
  private fetchImpl?: typeof fetch;
  private baseUrl?: string;

  constructor(options?: { model?: string; fetchImpl?: typeof fetch; baseUrl?: string }) {
    this.model = options?.model;
    this.fetchImpl = options?.fetchImpl;
    this.baseUrl = options?.baseUrl;
  }

  async available(): Promise<boolean> {
    const status = await probeOllama({
      fetchImpl: this.fetchImpl,
      baseUrl: this.baseUrl,
      preferredModel: this.model,
    });
    if (status.available) this.model = this.model ?? status.model;
    return status.available;
  }

  private async json<T>(prompt: string, system?: string): Promise<T | null> {
    const status = await probeOllama({
      fetchImpl: this.fetchImpl,
      baseUrl: this.baseUrl,
      preferredModel: this.model,
    });
    if (!status.available) return null;
    return ollamaJson<T>({
      prompt,
      model: this.model ?? status.model,
      fetchImpl: this.fetchImpl,
      baseUrl: this.baseUrl,
      system,
    });
  }

  async analyzePaper(paper: ExtractedPaper): Promise<PaperModel> {
    const fallback = await ruleBasedReasoning.analyzePaper(paper);
    const payload = await this.json<{ thesis?: string; researchQuestion?: string; limitations?: string[] }>(
      `Analyze this paper for a podcast. Return JSON {"thesis":string,"researchQuestion":string,"limitations":string[]}.
Title: ${paper.title}
Text: ${paper.text.slice(0, 6000)}`
    );
    if (!payload?.thesis || typeof payload.thesis !== "string") return fallback;
    return {
      ...fallback,
      thesis: payload.thesis,
      oneSentenceThesis: payload.thesis,
      researchQuestion: payload.researchQuestion ?? fallback.researchQuestion,
      limitations: Array.isArray(payload.limitations) && payload.limitations.length
        ? payload.limitations
        : fallback.limitations,
    };
  }

  async planEpisode(model: PaperModel, options: EpisodeOptions): Promise<EpisodePlan> {
    const fallback = planEpisode(model, options ?? DEFAULT_EPISODE_OPTIONS);
    const payload = await this.json<{ logline?: string }>(
      `Write a one-sentence logline for a two-host podcast about this thesis. Return JSON {"logline":string}.
Thesis: ${model.thesis}
Style: ${options.style}
Audience: ${options.audience}`
    );
    if (!payload?.logline || typeof payload.logline !== "string") return fallback;
    return { ...fallback, logline: payload.logline };
  }

  async writeScript(plan: EpisodePlan, model: PaperModel): Promise<PodcastScript> {
    const fallback = writeScript(
      model,
      plan,
      `Ollama (${this.model ?? "local"}) is on this machine, but this pass used the rule writer.`,
      { style: plan.style, length: "medium", audience: "general" }
    );
    const payload = await this.json<{ lines?: LlmScriptLine[] }>(
      `Write a two-host podcast from this episode plan. Maya asks; Jordan answers from claim.text.
Return {"lines":[{"host":"maya"|"jordan","text":string,"beatId":string,"claimId"?:string,"quote"?:string}]}
Thesis: ${model.thesis}
Claims: ${JSON.stringify(model.claims.map((c) => ({ id: c.id, kind: c.kind, text: c.text, numbers: c.numbers })))}
Beats: ${JSON.stringify(plan.beats.map((b) => ({ id: b.id, role: b.role, intent: b.intent, claimId: b.claimId, talkingPoints: b.talkingPoints, quote: b.quote })))}`
    );
    const lines = parseLlmScript(payload);
    if (!lines) return fallback;
    return scriptFromLlm(fallback, lines);
  }

  async critiqueScript(
    script: PodcastScript,
    model: PaperModel,
    sourceSentences: string[]
  ): Promise<ScriptCritiqueResult> {
    const plan = planEpisode(model, DEFAULT_EPISODE_OPTIONS);
    const fallback = critiqueScriptResult(model, plan, script, sourceSentences);
    const payload = await this.json<{
      issues?: ScriptIssue[];
      scores?: Partial<ScriptScores>;
    }>(
      `Critique this podcast script against the paper model. Strict JSON only.
Return {"issues":[{"severity":"low"|"medium"|"high","type":"repetition"|"unsupported_claim"|"missing_method"|"missing_limitations"|"robotic_phrase"|"weak_transition"|"too_extractive"|"too_verbose","message":string,"lineIds"?:string[]}],"scores":{"understanding":0-100,"sourceGrounding":0-100,"methodCoverage":0-100,"findingsCoverage":0-100,"limitationsCoverage":0-100,"nonRepetition":0-100,"conversationalQuality":0-100,"structure":0-100,"usefulness":0-100,"overall":0-100}}
Thesis: ${model.thesis}
Limitations: ${JSON.stringify(model.limitations)}
Script: ${JSON.stringify(script.lines.map((l) => ({ id: l.id, host: l.host, text: l.text })))}`
    );
    if (!payload?.scores) return fallback;
    const scores = { ...fallback.scores, ...sanitizeScores(payload.scores) };
    const issues = Array.isArray(payload.issues) && payload.issues.length ? payload.issues : fallback.issues;
    return { script, issues, scores };
  }
}

function sanitizeScores(partial: Partial<ScriptScores>): ScriptScores {
  const n = (v: unknown, fallback: number) => {
    const x = typeof v === "number" ? v : fallback;
    return Math.max(0, Math.min(100, Math.round(x)));
  };
  const overallFallback = 70;
  return {
    understanding: n(partial.understanding, overallFallback),
    sourceGrounding: n(partial.sourceGrounding, overallFallback),
    methodCoverage: n(partial.methodCoverage, overallFallback),
    findingsCoverage: n(partial.findingsCoverage, overallFallback),
    limitationsCoverage: n(partial.limitationsCoverage, overallFallback),
    nonRepetition: n(partial.nonRepetition, overallFallback),
    conversationalQuality: n(partial.conversationalQuality, overallFallback),
    structure: n(partial.structure, overallFallback),
    usefulness: n(partial.usefulness, overallFallback),
    overall: n(partial.overall, overallFallback),
  };
}

function scriptFromLlm(base: PodcastScript, llmLines: LlmScriptLine[]): PodcastScript {
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

export function createOllamaReasoningProvider(options?: {
  model?: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}): OllamaReasoningProvider {
  return new OllamaReasoningProvider(options);
}
