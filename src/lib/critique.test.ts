import { describe, expect, it } from "vitest";
import { critiqueEpisode, repairScript, sourceSentencesFrom } from "./critique";
import { planEpisode } from "./episode-plan";
import { quietHourDoc } from "./fixtures";
import { buildPaperModel, toExtractedPaper } from "./paper-model";
import { writeScript } from "./script";
import type { ScriptLine } from "./types";

describe("Critique", () => {
  const papers = [toExtractedPaper(quietHourDoc())];
  const model = buildPaperModel(papers);
  const plan = planEpisode(model);
  const script = writeScript(model, plan);
  const sources = sourceSentencesFrom(papers);

  it("passes a script written from the plan", () => {
    const report = critiqueEpisode(model, plan, script, sources);
    expect(report.passed).toBe(true);
    expect(report.score).toBeGreaterThanOrEqual(70);
    expect(report.issues.some((i) => i.code === "raw-sentence-leak")).toBe(false);
  });

  it("flags an intentionally ungrounded raw-sentence line and repair removes the leak", () => {
    const stolen = papers[0].sentences.find((s) => s.text.length > 80)?.text;
    expect(stolen).toBeTruthy();
    const poison: ScriptLine = {
      id: "poison-line",
      host: "jordan",
      text: stolen as string,
      beatId: plan.beats.find((b) => b.claimId)?.id,
      claimId: plan.beats.find((b) => b.claimId)?.claimId,
    };
    const dirty = { ...script, lines: [...script.lines, poison] };
    const report = critiqueEpisode(model, plan, dirty, sources);
    expect(report.passed).toBe(false);
    expect(report.issues.some((i) => i.code === "raw-sentence-leak" && i.lineId === "poison-line")).toBe(
      true
    );
    const fixed = repairScript(model, plan, dirty, sources, report);
    const again = critiqueEpisode(model, plan, fixed, sources);
    expect(again.issues.some((i) => i.lineId === "poison-line" && i.code === "raw-sentence-leak")).toBe(
      false
    );
  });
});
