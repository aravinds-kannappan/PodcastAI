import { describe, expect, it } from "vitest";
import { planEpisode } from "./episode-plan";
import { quietHourDoc } from "./fixtures";
import { buildPaperModel, toExtractedPaper } from "./paper-model";

describe("EpisodePlan", () => {
  const model = buildPaperModel([toExtractedPaper(quietHourDoc())]);
  const plan = planEpisode(model);

  it("plans beats from PaperModel claim ids, not raw extracted sentences", () => {
    const claimIds = new Set(model.claims.map((c) => c.id));
    const claimed = plan.beats.filter((b) => b.claimId);
    expect(claimed.length).toBeGreaterThanOrEqual(2);
    for (const beat of claimed) {
      expect(claimIds.has(beat.claimId as string)).toBe(true);
      expect(beat.intent.length).toBeGreaterThan(10);
      expect(beat.talkingPoints.length).toBeGreaterThan(0);
    }
    expect(plan.beats.some((b) => b.role === "cold-open")).toBe(true);
    expect(plan.beats.some((b) => b.role === "setup")).toBe(true);
    expect(plan.beats.some((b) => b.role === "takeaway")).toBe(true);
    expect(plan.beats.some((b) => b.role === "close")).toBe(true);
  });

  it("covers a method or caveat when the model has one", () => {
    if (model.claims.some((c) => c.kind === "limit")) {
      expect(plan.beats.some((b) => b.role === "caveat")).toBe(true);
    }
    if (model.claims.some((c) => c.kind === "method")) {
      expect(plan.beats.some((b) => b.role === "method")).toBe(true);
    }
  });
});
