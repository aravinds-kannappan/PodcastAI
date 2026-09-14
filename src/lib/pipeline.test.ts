import { describe, expect, it } from "vitest";
import { quietHourDoc } from "./fixtures";
import { LEAK_RUN, lineLeaks } from "./leak";
import { probeOllama } from "./ollama";
import { produceEpisode } from "./pipeline";

describe("Pipeline", () => {
  it("runs ExtractedPaper → PaperModel → EpisodePlan → Script → Critique → Benchmark", async () => {
    const stages: string[] = [];
    const result = await produceEpisode([quietHourDoc()], {
      forceRules: true,
      onStage: (s) => stages.push(s),
    });
    expect(stages).toEqual(["extract", "model", "plan", "script", "critique", "benchmark"]);
    expect(result.papers[0].sentences.length).toBeGreaterThan(0);
    expect(result.model.claims.length).toBeGreaterThanOrEqual(2);
    expect(result.plan.beats.some((b) => b.claimId)).toBe(true);
    expect(result.script.lines.length).toBeGreaterThanOrEqual(8);
    expect(result.critique.passed).toBe(true);
    expect(result.benchmark.extractiveLeak).toBe(0);
    expect(result.engine.kind).toBe("rules");
    expect(result.evaluation.judgeProvider).toBe("rules");
    expect(result.evaluation.scores.overall).toBeGreaterThanOrEqual(0);
    expect(result.options.style).toBe("thoughtful-talk");
    const sources = result.papers.flatMap((p) => p.sentences.map((s) => s.text));
    for (const row of result.script.lines) {
      expect(lineLeaks(row.text, sources, LEAK_RUN)).toBe(false);
    }
  });
});

describe("Ollama", () => {
  it("uses the rule fallback when the daemon is down", async () => {
    const status = await probeOllama({
      timeoutMs: 400,
      fetchImpl: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    expect(status.available).toBe(false);
    const result = await produceEpisode([quietHourDoc()], {
      fetchImpl: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    expect(result.engine.kind).toBe("rules");
    expect(result.script.lines.length).toBeGreaterThanOrEqual(8);
    expect(result.critique.passed).toBe(true);
  });

  it("picks a preferred local model name", async () => {
    const { pickOllamaModel } = await import("./ollama");
    expect(pickOllamaModel(["phi3:latest", "llama3.2:latest"])).toBe("llama3.2:latest");
    expect(pickOllamaModel(["mistral", "llama3.1:latest"])).toBe("llama3.1:latest");
    expect(pickOllamaModel([])).toBeUndefined();
  });
});
