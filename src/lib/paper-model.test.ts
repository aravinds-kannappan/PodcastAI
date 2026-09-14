import { describe, expect, it } from "vitest";
import { quietHourDoc } from "./fixtures";
import { LEAK_RUN, lineLeaks } from "./leak";
import { buildPaperModel, toExtractedPaper } from "./paper-model";

describe("PaperModel", () => {
  const paper = toExtractedPaper(quietHourDoc());
  const model = buildPaperModel([paper]);

  it("is built from ExtractedPaper sections and sentences, not a raw dump", () => {
    expect(paper.sections.length).toBeGreaterThan(0);
    expect(paper.sentences.length).toBeGreaterThan(4);
    expect(model.claims.length).toBeGreaterThanOrEqual(2);
    expect(model.thesis.length).toBeGreaterThan(20);
    expect(model.title.toLowerCase()).toMatch(/quiet hour/);
  });

  it("stores paraphrased claim text plus evidence, never as the sole dialogue source", () => {
    for (const claim of model.claims) {
      expect(claim.text).not.toEqual(claim.evidence);
      expect(claim.evidence.length).toBeGreaterThan(20);
      expect(lineLeaks(claim.text, [claim.evidence], LEAK_RUN)).toBe(false);
    }
    expect(model.claims.some((c) => c.kind === "finding")).toBe(true);
    expect(model.claims.some((c) => c.kind === "limit")).toBe(true);
  });
});
