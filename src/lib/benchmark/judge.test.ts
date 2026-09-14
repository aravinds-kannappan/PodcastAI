import { describe, expect, it } from "vitest";
import { judgeEpisode, ruleBasedJudge } from "./judge";
import { planEpisode } from "../episode-plan";
import { quietHourDoc } from "../fixtures";
import { buildPaperModel, toExtractedPaper } from "../paper-model";
import { writeScript } from "../script";
import { sourceSentencesFrom } from "../critique";
import { OllamaReasoningProvider } from "../reasoning/ollama-provider";
import { probeOllama } from "../ollama";

describe("benchmark judge fallback", () => {
  it("scores 0–100 without Ollama", async () => {
    const papers = [toExtractedPaper(quietHourDoc())];
    const model = buildPaperModel(papers);
    const plan = planEpisode(model);
    const script = writeScript(model, plan);
    const result = await judgeEpisode({
      model,
      plan,
      script,
      sourceSentences: sourceSentencesFrom(papers),
      documentName: "QuietHourMemo.txt",
      generatorProvider: "rules",
      judge: "ollama",
      fetchImpl: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    expect(result.judgeProvider).toBe("rules");
    expect(result.scores.overall).toBeGreaterThanOrEqual(0);
    expect(result.scores.overall).toBeLessThanOrEqual(100);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(Array.isArray(result.repeatedPhrases)).toBe(true);
    expect(Array.isArray(result.missingCoverage)).toBe(true);
    const local = ruleBasedJudge({
      model,
      plan,
      script,
      sourceSentences: sourceSentencesFrom(papers),
      documentName: "QuietHourMemo.txt",
      generatorProvider: "rules",
    });
    expect(local.scores.understanding).toBeGreaterThan(0);
  });
});

describe("Ollama reasoning provider", () => {
  it("treats a down daemon as unavailable", async () => {
    const provider = new OllamaReasoningProvider({
      fetchImpl: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    expect(await provider.available()).toBe(false);
    const status = await probeOllama({
      timeoutMs: 200,
      fetchImpl: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    expect(status.available).toBe(false);
    expect(status.models).toEqual([]);
  });
});
