import { planEpisode } from "@/lib/episode-plan";
import { buildPaperModel } from "@/lib/paper-model";
import { writeScript } from "@/lib/script";
import { critiqueScriptResult } from "@/lib/script-critic";
import type { ReasoningProvider } from "./types";
import type { ExtractedPaper } from "@/lib/types";
import { DEFAULT_EPISODE_OPTIONS } from "@/lib/types";

export class RuleBasedReasoningProvider implements ReasoningProvider {
  id = "rules";
  label = "Rule-based (on-device)";

  async available(): Promise<boolean> {
    return true;
  }

  async analyzePaper(paper: ExtractedPaper) {
    return buildPaperModel([paper]);
  }

  async analyzePapers(papers: ExtractedPaper[]) {
    return buildPaperModel(papers);
  }

  async planEpisode(model: Parameters<ReasoningProvider["planEpisode"]>[0], options: Parameters<ReasoningProvider["planEpisode"]>[1]) {
    return planEpisode(model, options ?? DEFAULT_EPISODE_OPTIONS);
  }

  async writeScript(plan: Parameters<ReasoningProvider["writeScript"]>[0], model: Parameters<ReasoningProvider["writeScript"]>[1]) {
    return writeScript(model, plan, "This booth used the rule writer because Ollama was not running.", {
      style: plan.style,
      length: "medium",
      audience: "general",
    });
  }

  async critiqueScript(
    script: Parameters<ReasoningProvider["critiqueScript"]>[0],
    model: Parameters<ReasoningProvider["critiqueScript"]>[1],
    sourceSentences: string[]
  ) {
    const rebuilt = planEpisode(model, DEFAULT_EPISODE_OPTIONS);
    return critiqueScriptResult(model, rebuilt, script, sourceSentences);
  }
}

export const ruleBasedReasoning = new RuleBasedReasoningProvider();
