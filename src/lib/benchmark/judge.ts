import { BENCHMARK_RUBRIC } from "./rubric";
import { critiqueScriptResult, findRepeatedPhrases } from "@/lib/script-critic";
import { ollamaJson, probeOllama } from "@/lib/ollama";
import { makeId } from "@/lib/text";
import type {
  BenchmarkResult,
  EpisodeOptions,
  EpisodePlan,
  EpisodeResult,
  JudgeKind,
  PaperModel,
  PodcastScript,
  ScriptIssue,
  ScriptScores,
} from "@/lib/types";
import { DEFAULT_EPISODE_OPTIONS } from "@/lib/types";

function missingCoverage(model: PaperModel, script: PodcastScript): string[] {
  const spoken = new Set(script.lines.map((l) => l.claimId).filter(Boolean));
  const missing: string[] = [];
  if (model.claims.some((c) => c.kind === "method") && !model.claims.some((c) => c.kind === "method" && spoken.has(c.id))) {
    missing.push("methods");
  }
  if (model.claims.some((c) => c.kind === "finding") && !model.claims.some((c) => c.kind === "finding" && spoken.has(c.id))) {
    missing.push("key findings");
  }
  if (model.limitations.length && !model.claims.some((c) => c.kind === "limit" && spoken.has(c.id))) {
    missing.push("limitations");
  }
  if (model.implications.length && !model.claims.some((c) => c.kind === "recommendation" && spoken.has(c.id))) {
    missing.push("implications");
  }
  return missing;
}

function unsupportedClaims(model: PaperModel, issues: ScriptIssue[]): string[] {
  const ids = new Set(issues.filter((i) => i.type === "unsupported_claim").flatMap((i) => i.lineIds ?? []));
  return model.claims.filter((c) => c.kind === "finding").length && ids.size
    ? [`${ids.size} spoken line(s) were not grounded in a PaperModel claim.`]
    : [];
}

function recommendationsFrom(issues: ScriptIssue[], missing: string[], repeats: string[]): string[] {
  const recs: string[] = [];
  if (missing.includes("methods")) recs.push("Give Maya one question that forces Jordan to voice the counting rule.");
  if (missing.includes("limitations")) recs.push("Add a caveat beat so the listener hears what the paper does not prove.");
  if (missing.includes("key findings")) recs.push("Put the headline comparison in Jordan’s mouth before the recap.");
  if (repeats.length) recs.push("Cut repeated n-grams so each exchange advances the argument.");
  if (issues.some((i) => i.type === "robotic_phrase")) recs.push("Delete podcast filler. Ask a real question instead.");
  if (issues.some((i) => i.type === "too_extractive")) recs.push("Paraphrase from the PaperModel; do not paste source sentences.");
  if (issues.some((i) => i.type === "unsupported_claim")) recs.push("Drop any Jordan line that is not backed by a modeled claim.");
  if (!recs.length) recs.push("Keep the plan-first loop. The next pass should change a beat, not a template.");
  return recs.slice(0, 6);
}

function summaryFrom(scores: ScriptScores, missing: string[], generator: string, judge: string): string {
  const hole = missing.length ? ` Missing coverage: ${missing.join(", ")}.` : "";
  return `Overall ${scores.overall}/100. Generator: ${generator}. Judge: ${judge}. Understanding ${scores.understanding}, grounding ${scores.sourceGrounding}, non-repetition ${scores.nonRepetition}.${hole}`;
}

export function ruleBasedJudge(input: {
  model: PaperModel;
  plan: EpisodePlan;
  script: PodcastScript;
  sourceSentences: string[];
  options?: EpisodeOptions;
  documentName: string;
  generatorProvider: string;
}): BenchmarkResult {
  const crit = critiqueScriptResult(input.model, input.plan, input.script, input.sourceSentences);
  const repeats = findRepeatedPhrases(input.script);
  const missing = missingCoverage(input.model, input.script);
  const unsupported = unsupportedClaims(input.model, crit.issues);
  return {
    id: makeId("bench"),
    createdAt: new Date().toISOString(),
    documentName: input.documentName,
    generatorProvider: input.generatorProvider,
    judgeProvider: "rules",
    options: input.options ?? DEFAULT_EPISODE_OPTIONS,
    scores: crit.scores,
    issues: crit.issues,
    summary: summaryFrom(crit.scores, missing, input.generatorProvider, "rules"),
    recommendations: recommendationsFrom(crit.issues, missing, repeats),
    scriptWordCount: input.script.wordCount,
    repeatedPhrases: repeats,
    unsupportedClaims: unsupported,
    missingCoverage: missing,
  };
}

function clampScore(n: unknown, fallback: number): number {
  if (typeof n !== "number" || Number.isNaN(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function mergeOllamaJudge(
  base: BenchmarkResult,
  payload: Partial<BenchmarkResult> & { scores?: Partial<ScriptScores> },
  modelName: string
): BenchmarkResult {
  const scores: ScriptScores = {
    understanding: clampScore(payload.scores?.understanding, base.scores.understanding),
    sourceGrounding: clampScore(payload.scores?.sourceGrounding, base.scores.sourceGrounding),
    methodCoverage: clampScore(payload.scores?.methodCoverage, base.scores.methodCoverage),
    findingsCoverage: clampScore(payload.scores?.findingsCoverage, base.scores.findingsCoverage),
    limitationsCoverage: clampScore(payload.scores?.limitationsCoverage, base.scores.limitationsCoverage),
    nonRepetition: clampScore(payload.scores?.nonRepetition, base.scores.nonRepetition),
    conversationalQuality: clampScore(payload.scores?.conversationalQuality, base.scores.conversationalQuality),
    structure: clampScore(payload.scores?.structure, base.scores.structure),
    usefulness: clampScore(payload.scores?.usefulness, base.scores.usefulness),
    overall: clampScore(payload.scores?.overall, base.scores.overall),
  };
  const issues = Array.isArray(payload.issues) && payload.issues.length ? payload.issues : base.issues;
  const missing = Array.isArray(payload.missingCoverage) ? payload.missingCoverage : base.missingCoverage;
  const repeats = Array.isArray(payload.repeatedPhrases) ? payload.repeatedPhrases : base.repeatedPhrases;
  return {
    ...base,
    judgeProvider: "ollama",
    judgeModel: modelName,
    scores,
    issues,
    summary:
      typeof payload.summary === "string" && payload.summary.trim()
        ? payload.summary.trim()
        : summaryFrom(scores, missing, base.generatorProvider, `ollama:${modelName}`),
    recommendations:
      Array.isArray(payload.recommendations) && payload.recommendations.length
        ? payload.recommendations
        : base.recommendations,
    repeatedPhrases: repeats,
    unsupportedClaims: Array.isArray(payload.unsupportedClaims) ? payload.unsupportedClaims : base.unsupportedClaims,
    missingCoverage: missing,
  };
}

export async function ollamaJudge(input: {
  model: PaperModel;
  plan: EpisodePlan;
  script: PodcastScript;
  sourceSentences: string[];
  options?: EpisodeOptions;
  documentName: string;
  generatorProvider: string;
  judgeModel?: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}): Promise<BenchmarkResult | null> {
  const status = await probeOllama({
    fetchImpl: input.fetchImpl,
    baseUrl: input.baseUrl,
    preferredModel: input.judgeModel,
    timeoutMs: 2000,
  });
  if (!status.available) return null;
  const payload = await ollamaJson<Partial<BenchmarkResult> & { scores?: Partial<ScriptScores> }>({
    model: input.judgeModel ?? status.model,
    fetchImpl: input.fetchImpl,
    baseUrl: input.baseUrl,
    timeoutMs: 45000,
    system: BENCHMARK_RUBRIC,
    prompt: `PaperModel thesis: ${input.model.thesis}
Method: ${input.model.method}
Limitations: ${JSON.stringify(input.model.limitations)}
Claims: ${JSON.stringify(input.model.claims.map((c) => ({ id: c.id, kind: c.kind, text: c.text })))}
Script: ${JSON.stringify(input.script.lines.map((l) => ({ id: l.id, host: l.host, text: l.text, beatId: l.beatId })))}
Takeaways: ${JSON.stringify(input.script.takeaways)}`,
  });
  if (!payload?.scores) return null;
  const base = ruleBasedJudge(input);
  return mergeOllamaJudge(base, payload, input.judgeModel ?? status.model);
}

export async function judgeEpisode(input: {
  model: PaperModel;
  plan: EpisodePlan;
  script: PodcastScript;
  sourceSentences: string[];
  options?: EpisodeOptions;
  documentName: string;
  generatorProvider: string;
  judge: JudgeKind;
  judgeModel?: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}): Promise<BenchmarkResult> {
  const fallback = ruleBasedJudge(input);
  if (input.judge !== "ollama") return fallback;
  const judged = await ollamaJudge(input);
  return judged ?? fallback;
}

export function evaluationFromEpisode(result: EpisodeResult, judge?: BenchmarkResult): BenchmarkResult {
  return (
    judge ??
    result.evaluation ??
    ruleBasedJudge({
      model: result.model,
      plan: result.plan,
      script: result.script,
      sourceSentences: result.papers.flatMap((p) => p.sentences.map((s) => s.text)),
      options: result.options,
      documentName: result.papers.map((p) => p.name).join(", "),
      generatorProvider: result.engine.kind,
    })
  );
}
