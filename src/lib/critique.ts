import { LEAK_RUN, lineLeaks, longestSourceRun } from "./leak";
import { clipQuote, makeId, overlap, tokenSet } from "./text";
import type {
  CritiqueIssue,
  CritiqueReport,
  EpisodePlan,
  PaperModel,
  PodcastScript,
  ScriptLine,
} from "./types";

export function sourceSentencesFrom(papers: { sentences: { text: string }[] }[]): string[] {
  return papers.flatMap((p) => p.sentences.map((s) => s.text));
}

export function critiqueEpisode(
  model: PaperModel,
  plan: EpisodePlan,
  script: PodcastScript,
  sourceSentences: string[]
): CritiqueReport {
  const issues: CritiqueIssue[] = [];
  const claimBeats = plan.beats.filter((b) => b.claimId);
  const spokenClaimIds = new Set(script.lines.map((l) => l.claimId).filter(Boolean));

  for (const beat of claimBeats) {
    if (beat.claimId && !spokenClaimIds.has(beat.claimId)) {
      issues.push({
        severity: "error",
        code: "plan-skipped",
        message: `Plan beat ${beat.role} never made it into the script.`,
        claimId: beat.claimId,
      });
    }
  }

  const salient = model.claims.filter((c) => c.salience >= 6).slice(0, 5);
  for (const claim of salient) {
    if (!spokenClaimIds.has(claim.id) && claimBeats.some((b) => b.claimId === claim.id)) {
      issues.push({
        severity: "warn",
        code: "missing-claim",
        message: `Salient ${claim.kind} claim is thin in the spoken script.`,
        claimId: claim.id,
      });
    }
  }

  const hasLimit = model.claims.some((c) => c.kind === "limit");
  const spokeLimit = script.lines.some((l) => {
    const claim = model.claims.find((c) => c.id === l.claimId);
    return claim?.kind === "limit";
  });
  if (hasLimit && !spokeLimit) {
    issues.push({
      severity: "error",
      code: "missing-limit",
      message: "The paper model has a limitation that the script never voices.",
    });
  }

  for (const row of script.lines) {
    const run = longestSourceRun(row.text, sourceSentences);
    if (run >= LEAK_RUN) {
      issues.push({
        severity: "error",
        code: "raw-sentence-leak",
        message: `Spoken line copies ${run} consecutive words from the source.`,
        lineId: row.id,
        claimId: row.claimId,
      });
    }
    if (row.host === "jordan" && row.claimId) {
      const claim = model.claims.find((c) => c.id === row.claimId);
      if (claim) {
        const grounded =
          overlap(tokenSet(row.text), tokenSet(claim.text)) >= 0.25 ||
          overlap(tokenSet(row.text), tokenSet(claim.evidence)) >= 0.2 ||
          claim.numbers.some((n) => row.text.includes(n));
        if (!grounded) {
          issues.push({
            severity: "error",
            code: "ungrounded",
            message: "A Jordan line is not grounded in its PaperModel claim.",
            lineId: row.id,
            claimId: row.claimId,
          });
        }
      }
    }
  }

  const maya = script.lines.filter((l) => l.host === "maya").length;
  const jordan = script.lines.filter((l) => l.host === "jordan").length;
  const total = maya + jordan;
  if (total >= 6) {
    const share = maya / total;
    if (share < 0.28 || share > 0.62) {
      issues.push({
        severity: "warn",
        code: "host-imbalance",
        message: `Host mix is off (Maya ${maya}, Jordan ${jordan}).`,
      });
    }
  }

  if (script.lines.length < 8) {
    issues.push({
      severity: "error",
      code: "too-short",
      message: "Script is too short to be an episode.",
    });
  }

  const errors = issues.filter((i) => i.severity === "error").length;
  const warns = issues.filter((i) => i.severity === "warn").length;
  const score = Math.max(0, Math.min(100, 100 - errors * 18 - warns * 6));
  return { score, passed: errors === 0, issues };
}

export function repairScript(
  model: PaperModel,
  plan: EpisodePlan,
  script: PodcastScript,
  sourceSentences: string[],
  report: CritiqueReport
): PodcastScript {
  if (report.passed) return script;
  const leakIds = new Set(
    report.issues.filter((i) => i.code === "raw-sentence-leak" && i.lineId).map((i) => i.lineId as string)
  );
  const lines: ScriptLine[] = script.lines.map((row) => {
    if (!leakIds.has(row.id)) return row;
    const claim = model.claims.find((c) => c.id === row.claimId);
    const replacement = claim
      ? `${claim.text} I'm staying with the model, not the original wording.`
      : "I'll keep this in the model instead of reading the page.";
    const next = { ...row, text: replacement };
    if (lineLeaks(next.text, sourceSentences)) {
      next.text = "The claim is in the PaperModel; I'm not going to paste the source sentence.";
    }
    return next;
  });

  const missingLimit = report.issues.some((i) => i.code === "missing-limit");
  const limit = model.claims.find((c) => c.kind === "limit");
  if (missingLimit && limit && !lines.some((l) => l.claimId === limit.id)) {
    const beat = plan.beats.find((b) => b.claimId === limit.id);
    const closeAt = lines.findIndex((l) => /That's PaperCast/.test(l.text));
    const insertAt = closeAt >= 0 ? closeAt : lines.length;
    const extra: ScriptLine[] = [
      {
        id: makeId("line"),
        host: "maya",
        text: "Wait. What's the catch if someone tries to use this on Monday?",
        beatId: beat?.id,
        claimId: limit.id,
        quote: clipQuote(limit.evidence, 200),
      },
      {
        id: makeId("line"),
        host: "jordan",
        text: `${limit.text} That's the grain of salt, not a reason to bin the rest.`,
        beatId: beat?.id,
        claimId: limit.id,
        quote: clipQuote(limit.evidence, 200),
      },
    ];
    lines.splice(insertAt, 0, ...extra);
  }

  const wordCount = lines.reduce((n, l) => n + l.text.split(/\s+/).filter(Boolean).length, 0);
  return {
    ...script,
    lines,
    wordCount,
    estimatedSeconds: Math.max(45, Math.round((wordCount / 155) * 60)),
  };
}
