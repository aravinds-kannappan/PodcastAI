export type HostId = "maya" | "jordan";

export type ClaimKind =
  | "finding"
  | "method"
  | "limit"
  | "number"
  | "background"
  | "recommendation";

export type BeatRole =
  | "cold-open"
  | "setup"
  | "claim"
  | "method"
  | "number"
  | "caveat"
  | "bridge"
  | "takeaway"
  | "close";

export type PipelineStage =
  | "extract"
  | "model"
  | "plan"
  | "script"
  | "critique"
  | "benchmark";

export type EngineKind = "ollama" | "rules";

export type ExtractedDoc = {
  id: string;
  name: string;
  kind: "pdf" | "text" | "markdown" | "docx" | "html" | "other";
  text: string;
  pages?: number;
  wordCount: number;
};

export type PaperSection = {
  heading: string;
  body: string;
};

export type SourceSentence = {
  id: string;
  text: string;
  section: string;
  order: number;
};

export type ExtractedPaper = ExtractedDoc & {
  title: string;
  sections: PaperSection[];
  sentences: SourceSentence[];
};

export type ModelClaim = {
  id: string;
  kind: ClaimKind;
  text: string;
  evidence: string;
  section: string;
  sourceName: string;
  salience: number;
  numbers: string[];
};

export type PaperModel = {
  title: string;
  thesis: string;
  authorsLine?: string;
  claims: ModelClaim[];
  sourceNames: string[];
  wordCount: number;
};

export type PlanBeat = {
  id: string;
  role: BeatRole;
  intent: string;
  claimId?: string;
  talkingPoints: string[];
  quote?: string;
};

export type EpisodePlan = {
  episodeTitle: string;
  logline: string;
  beats: PlanBeat[];
  takeaways: string[];
};

export type ScriptLine = {
  id: string;
  host: HostId;
  text: string;
  quote?: string;
  beatId?: string;
  claimId?: string;
};

export type PodcastScript = {
  showTitle: string;
  episodeTitle: string;
  logline: string;
  sources: { name: string; words: number; pages?: number }[];
  takeaways: string[];
  lines: ScriptLine[];
  wordCount: number;
  estimatedSeconds: number;
};

export type CritiqueIssueCode =
  | "ungrounded"
  | "raw-sentence-leak"
  | "host-imbalance"
  | "missing-claim"
  | "missing-limit"
  | "too-short"
  | "plan-skipped";

export type CritiqueIssue = {
  severity: "error" | "warn";
  code: CritiqueIssueCode;
  message: string;
  lineId?: string;
  claimId?: string;
};

export type CritiqueReport = {
  score: number;
  passed: boolean;
  issues: CritiqueIssue[];
};

export type BenchmarkReport = {
  coverage: number;
  grounding: number;
  extractiveLeak: number;
  hostBalance: number;
  durationSeconds: number;
  claimCount: number;
  lineCount: number;
  engine: EngineKind;
};

export type EngineInfo = {
  kind: EngineKind;
  model?: string;
  note: string;
};

export type EpisodeResult = {
  papers: ExtractedPaper[];
  model: PaperModel;
  plan: EpisodePlan;
  script: PodcastScript;
  critique: CritiqueReport;
  benchmark: BenchmarkReport;
  engine: EngineInfo;
};

export type UploadItem = {
  id: string;
  file: File;
  status: "queued" | "reading" | "ready" | "error";
  error?: string;
  doc?: ExtractedDoc;
};

export const HOSTS: Record<HostId, { name: string; role: string; short: string }> = {
  maya: { name: "Maya Reed", role: "Host", short: "Maya" },
  jordan: { name: "Jordan Hale", role: "Reader", short: "Jordan" },
};

export const PIPELINE_STAGES: { id: PipelineStage; label: string }[] = [
  { id: "extract", label: "ExtractedPaper" },
  { id: "model", label: "PaperModel" },
  { id: "plan", label: "EpisodePlan" },
  { id: "script", label: "Script" },
  { id: "critique", label: "Critique" },
  { id: "benchmark", label: "Benchmark" },
];
