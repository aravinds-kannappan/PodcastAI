import type {
  EpisodeOptions,
  ExtractedPaper,
  PaperModel,
  EpisodePlan,
  PodcastScript,
  ScriptCritiqueResult,
} from "@/lib/types";

export type { EpisodeOptions, ExtractedPaper, PaperModel, EpisodePlan, PodcastScript, ScriptCritiqueResult };

export interface ReasoningProvider {
  id: string;
  label: string;
  available(): Promise<boolean>;
  analyzePaper(paper: ExtractedPaper): Promise<PaperModel>;
  planEpisode(model: PaperModel, options: EpisodeOptions): Promise<EpisodePlan>;
  writeScript(plan: EpisodePlan, model: PaperModel): Promise<PodcastScript>;
  critiqueScript(script: PodcastScript, model: PaperModel, sourceSentences: string[]): Promise<ScriptCritiqueResult>;
}
