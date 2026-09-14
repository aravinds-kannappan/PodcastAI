import { LEAK_RUN, longestSourceRun } from "./leak";
import { overlap, tokenSet } from "./text";
import type {
  BenchmarkReport,
  EngineKind,
  EpisodePlan,
  PaperModel,
  PodcastScript,
} from "./types";

export function benchmarkEpisode(
  model: PaperModel,
  plan: EpisodePlan,
  script: PodcastScript,
  sourceSentences: string[],
  engine: EngineKind
): BenchmarkReport {
  const planned = plan.beats.map((b) => b.claimId).filter(Boolean) as string[];
  const spoken = new Set(script.lines.map((l) => l.claimId).filter(Boolean));
  const coverage = planned.length
    ? planned.filter((id) => spoken.has(id)).length / planned.length
    : 1;

  const jordan = script.lines.filter((l) => l.host === "jordan" && l.claimId);
  let grounded = 0;
  for (const row of jordan) {
    const claim = model.claims.find((c) => c.id === row.claimId);
    if (!claim) continue;
    const ok =
      overlap(tokenSet(row.text), tokenSet(claim.text)) >= 0.2 ||
      overlap(tokenSet(row.text), tokenSet(claim.evidence)) >= 0.18 ||
      Boolean(row.quote) ||
      claim.numbers.some((n) => row.text.includes(n));
    if (ok) grounded++;
  }
  const grounding = jordan.length ? grounded / jordan.length : 1;

  const leaks = script.lines.filter((l) => longestSourceRun(l.text, sourceSentences) >= LEAK_RUN);
  const extractiveLeak = script.lines.length ? leaks.length / script.lines.length : 0;

  const mayaN = script.lines.filter((l) => l.host === "maya").length;
  const total = script.lines.length || 1;
  const hostBalance = 1 - Math.min(1, Math.abs(mayaN / total - 0.42) * 2);

  return {
    coverage: round4(coverage),
    grounding: round4(grounding),
    extractiveLeak: round4(extractiveLeak),
    hostBalance: round4(hostBalance),
    durationSeconds: script.estimatedSeconds,
    claimCount: model.claims.length,
    lineCount: script.lines.length,
    engine,
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function benchmarkPasses(report: BenchmarkReport): boolean {
  return (
    report.coverage >= 0.8 &&
    report.grounding >= 0.75 &&
    report.extractiveLeak === 0 &&
    report.lineCount >= 8 &&
    report.hostBalance >= 0.35
  );
}
