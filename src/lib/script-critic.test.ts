import { describe, expect, it } from "vitest";
import { critiqueIssuesFromScript, findRepeatedPhrases } from "./script-critic";
import { planEpisode } from "./episode-plan";
import { quietHourDoc } from "./fixtures";
import { buildPaperModel, toExtractedPaper } from "./paper-model";
import { writeScript } from "./script";

describe("script critic", () => {
  it("flags repeated phrases and robotic filler", () => {
    const papers = [toExtractedPaper(quietHourDoc())];
    const model = buildPaperModel(papers);
    const plan = planEpisode(model);
    const script = writeScript(model, plan);
    const repeated =
      "The measured quiet hour changes afternoon briefing recall for every tired manager on Monday.";
    const tiny = {
      ...script,
      lines: [
        {
          id: "rpt-1",
          host: "maya" as const,
          text: `Let's dive in. That's fascinating. ${repeated}`,
        },
        {
          id: "rpt-2",
          host: "jordan" as const,
          text: `Let's dive in. That's fascinating. ${repeated}`,
        },
      ],
    };
    const repeats = findRepeatedPhrases(tiny, 3);
    expect(repeats.some((p) => p.includes("quiet hour") || p.includes("dive in") || p.includes("fascinating"))).toBe(
      true
    );
    const issues = critiqueIssuesFromScript(
      model,
      plan,
      tiny,
      papers.flatMap((p) => p.sentences.map((s) => s.text))
    );
    expect(issues.some((i) => i.type === "repetition")).toBe(true);
    expect(issues.some((i) => i.type === "robotic_phrase")).toBe(true);
  });
});
