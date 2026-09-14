import { critiqueEpisode, sourceSentencesFrom } from "./critique";
import { wordTokens } from "./text";
import type {
  EpisodePlan,
  PaperModel,
  PodcastScript,
  ScriptIssue,
  ScriptScores,
  ScriptCritiqueResult,
} from "./types";

export const ROBOTIC_PHRASES = [
  "let's dive in",
  "that's fascinating",
  "great point",
  "absolutely",
  "let's unpack that",
  "without further ado",
  "stay tuned",
  "welcome back",
];

const FILLER_OPENERS = ["so yeah", "i mean", "you know", "basically"];

export function findRepeatedPhrases(script: PodcastScript, n = 4): string[] {
  const counts = new Map<string, number>();
  for (const line of script.lines) {
    const tokens = wordTokens(line.text);
    for (let i = 0; i <= tokens.length - n; i++) {
      const gram = tokens.slice(i, i + n).join(" ");
      if (gram.length < 12) continue;
      counts.set(gram, (counts.get(gram) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([gram]) => gram)
    .slice(0, 8);
}

function roboticHits(script: PodcastScript): { phrase: string; lineIds: string[] }[] {
  const hits: { phrase: string; lineIds: string[] }[] = [];
  for (const phrase of [...ROBOTIC_PHRASES, ...FILLER_OPENERS]) {
    const lineIds = script.lines.filter((l) => l.text.toLowerCase().includes(phrase)).map((l) => l.id);
    if (lineIds.length) hits.push({ phrase, lineIds });
  }
  return hits;
}

function restatementIssues(script: PodcastScript): ScriptIssue[] {
  const issues: ScriptIssue[] = [];
  for (let i = 1; i < script.lines.length; i++) {
    const prev = wordTokens(script.lines[i - 1].text);
    const cur = wordTokens(script.lines[i].text);
    if (prev.length < 6 || cur.length < 6) continue;
    const set = new Set(prev);
    const overlap = cur.filter((w) => set.has(w)).length / Math.min(prev.length, cur.length);
    if (overlap >= 0.72) {
      issues.push({
        severity: "medium",
        type: "repetition",
        message: "A line mostly restates the previous line instead of advancing the argument.",
        lineIds: [script.lines[i - 1].id, script.lines[i].id],
      });
    }
  }
  return issues;
}

export function critiqueIssuesFromScript(
  model: PaperModel,
  plan: EpisodePlan,
  script: PodcastScript,
  sourceSentences: string[]
): ScriptIssue[] {
  const report = critiqueEpisode(model, plan, script, sourceSentences);
  const issues: ScriptIssue[] = report.issues.map((issue) => {
    const high = issue.severity === "error";
    const type =
      issue.code === "raw-sentence-leak"
        ? "too_extractive"
        : issue.code === "ungrounded"
          ? "unsupported_claim"
          : issue.code === "missing-limit"
            ? "missing_limitations"
            : issue.code === "too-short"
              ? "too_verbose"
              : issue.code === "plan-skipped"
                ? "weak_transition"
                : "weak_transition";
    return {
      severity: high ? "high" : "medium",
      type,
      message: issue.message,
      lineIds: issue.lineId ? [issue.lineId] : undefined,
    };
  });

  const spoken = new Set(script.lines.map((l) => l.claimId).filter(Boolean));
  if (model.claims.some((c) => c.kind === "method") && !model.claims.some((c) => c.kind === "method" && spoken.has(c.id))) {
    issues.push({
      severity: "high",
      type: "missing_method",
      message: "The PaperModel has a method claim that the script never voices.",
    });
  }

  for (const hit of roboticHits(script)) {
    issues.push({
      severity: "medium",
      type: "robotic_phrase",
      message: `Robotic filler: “${hit.phrase}”.`,
      lineIds: hit.lineIds,
    });
  }

  const repeats = findRepeatedPhrases(script);
  for (const phrase of repeats.slice(0, 4)) {
    issues.push({
      severity: "medium",
      type: "repetition",
      message: `Repeated phrase: “${phrase}”.`,
    });
  }

  issues.push(...restatementIssues(script));

  if (script.wordCount > 1800) {
    issues.push({
      severity: "low",
      type: "too_verbose",
      message: "The episode is long for a first pass. Cut a beat if a listener would tune out.",
    });
  }

  return issues;
}

export function scoreScript(
  model: PaperModel,
  plan: EpisodePlan,
  script: PodcastScript,
  issues: ScriptIssue[],
  sourceSentences: string[]
): ScriptScores {
  const report = critiqueEpisode(model, plan, script, sourceSentences);
  const spoken = new Set(script.lines.map((l) => l.claimId).filter(Boolean));
  const ofKind = (kind: PaperModel["claims"][number]["kind"]) => model.claims.filter((c) => c.kind === kind);
  const cover = (kind: PaperModel["claims"][number]["kind"]) => {
    const rows = ofKind(kind);
    if (!rows.length) return 100;
    return Math.round((rows.filter((c) => spoken.has(c.id)).length / rows.length) * 100);
  };

  const robotic = issues.filter((i) => i.type === "robotic_phrase").length;
  const repeats = issues.filter((i) => i.type === "repetition").length;
  const extractive = issues.filter((i) => i.type === "too_extractive").length;
  const unsupported = issues.filter((i) => i.type === "unsupported_claim").length;

  const understanding = clamp(
    Math.round(
      0.5 * cover("finding") +
        0.2 * cover("method") +
        0.2 * (model.thesis.length > 20 ? 100 : 40) +
        0.1 * (plan.beats.length >= 6 ? 100 : 60)
    )
  );
  const sourceGrounding = clamp(Math.round(report.score - unsupported * 8));
  const methodCoverage = cover("method");
  const findingsCoverage = cover("finding");
  const limitationsCoverage = cover("limit");
  const nonRepetition = clamp(100 - repeats * 12 - extractive * 25);
  const conversationalQuality = clamp(100 - robotic * 15 - (script.lines.length < 8 ? 20 : 0));
  const purposes = new Set(plan.beats.map((b) => b.purpose));
  const structure = clamp(
    55 +
      (purposes.has("hook") ? 8 : 0) +
      (purposes.has("thesis") ? 8 : 0) +
      (purposes.has("method") || methodCoverage === 100 ? 8 : 0) +
      (purposes.has("limitation") || limitationsCoverage === 100 ? 8 : 0) +
      (purposes.has("implication") ? 8 : 0) +
      (plan.beats.length >= 6 ? 5 : 0)
  );
  const usefulness = clamp(40 + Math.min(40, script.takeaways.length * 15) + (limitationsCoverage > 0 ? 10 : 0));
  const overall = clamp(
    Math.round(
      understanding * 0.16 +
        sourceGrounding * 0.16 +
        methodCoverage * 0.08 +
        findingsCoverage * 0.08 +
        limitationsCoverage * 0.1 +
        nonRepetition * 0.14 +
        conversationalQuality * 0.1 +
        structure * 0.1 +
        usefulness * 0.08
    )
  );

  return {
    understanding,
    sourceGrounding,
    methodCoverage,
    findingsCoverage,
    limitationsCoverage,
    nonRepetition,
    conversationalQuality,
    structure,
    usefulness,
    overall,
  };
}

export function critiqueScriptResult(
  model: PaperModel,
  plan: EpisodePlan,
  script: PodcastScript,
  sourceSentences: string[]
): ScriptCritiqueResult {
  const issues = critiqueIssuesFromScript(model, plan, script, sourceSentences);
  return {
    script,
    issues,
    scores: scoreScript(model, plan, script, issues, sourceSentences),
  };
}

export { sourceSentencesFrom };

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}
