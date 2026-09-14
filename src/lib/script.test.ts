import { describe, expect, it } from "vitest";
import { planEpisode } from "./episode-plan";
import { quietHourDoc } from "./fixtures";
import { LEAK_RUN, lineLeaks } from "./leak";
import { buildPaperModel, toExtractedPaper } from "./paper-model";
import { writeScript } from "./script";

describe("Script", () => {
  const paper = toExtractedPaper(quietHourDoc());
  const model = buildPaperModel([paper]);
  const plan = planEpisode(model);
  const script = writeScript(model, plan);

  it("is generated from EpisodePlan beats, not raw extracted sentences", () => {
    const planIds = new Set(plan.beats.map((b) => b.id));
    expect(script.lines.length).toBeGreaterThanOrEqual(8);
    expect(script.lines.every((l) => l.beatId && planIds.has(l.beatId))).toBe(true);
    const claimed = script.lines.filter((l) => l.claimId);
    expect(claimed.length).toBeGreaterThanOrEqual(2);
  });

  it("does not copy source sentences into spoken dialogue", () => {
    const sources = paper.sentences.map((s) => s.text);
    for (const row of script.lines) {
      expect(lineLeaks(row.text, sources, LEAK_RUN)).toBe(false);
      for (const sentence of sources) {
        expect(row.text).not.toEqual(sentence);
        expect(row.text.includes(sentence)).toBe(false);
      }
    }
  });
});
