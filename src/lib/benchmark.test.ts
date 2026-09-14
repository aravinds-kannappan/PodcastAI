import { describe, expect, it } from "vitest";
import { benchmarkEpisode, benchmarkPasses } from "./benchmark";
import { sourceSentencesFrom } from "./critique";
import { planEpisode } from "./episode-plan";
import { quietHourDoc } from "./fixtures";
import { buildPaperModel, toExtractedPaper } from "./paper-model";
import { writeScript } from "./script";

describe("Benchmark", () => {
  it("reports coverage, grounding, and zero extractive leak for the rule writer", () => {
    const papers = [toExtractedPaper(quietHourDoc())];
    const model = buildPaperModel(papers);
    const plan = planEpisode(model);
    const script = writeScript(model, plan);
    const report = benchmarkEpisode(model, plan, script, sourceSentencesFrom(papers), "rules");
    expect(report.coverage).toBeGreaterThanOrEqual(0.8);
    expect(report.grounding).toBeGreaterThanOrEqual(0.75);
    expect(report.extractiveLeak).toBe(0);
    expect(report.claimCount).toBe(model.claims.length);
    expect(report.lineCount).toBe(script.lines.length);
    expect(report.engine).toBe("rules");
    expect(benchmarkPasses(report)).toBe(true);
  });
});
