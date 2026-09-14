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

export type EpisodeStyle =
  | "thoughtful-talk"
  | "lecture"
  | "fast-briefing"
  | "deep-dive"
  | "reviewer";

export type EpisodeLength = "short" | "medium" | "long";

export type EpisodeAudience = "general" | "student" | "researcher" | "executive";

export type EpisodeOptions = {
  style: EpisodeStyle;
  length: EpisodeLength;
  audience: EpisodeAudience;
};

export const DEFAULT_EPISODE_OPTIONS: EpisodeOptions = {
  style: "thoughtful-talk",
  length: "medium",
  audience: "general",
};

export const EPISODE_STYLE_LABELS: Record<EpisodeStyle, string> = {
  "thoughtful-talk": "Thoughtful Talk",
  lecture: "Lecture",
  "fast-briefing": "Fast Briefing",
  "deep-dive": "Deep Dive",
  reviewer: "Reviewer Mode",
};

export const EPISODE_LENGTH_LABELS: Record<EpisodeLength, string> = {
  short: "Short",
  medium: "Medium",
  long: "Long",
};

export const EPISODE_AUDIENCE_LABELS: Record<EpisodeAudience, string> = {
  general: "General",
  student: "Student",
  researcher: "Researcher",
  executive: "Executive",
};

export type SourceCoverage = {
  section: string;
  used: boolean;
  reason?: string;
};

export type PaperSection = {
  id: string;
  heading: string;
  body: string;
  order: number;
  pageStart?: number;
  pageEnd?: number;
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
  oneSentenceThesis: string;
  researchQuestion?: string;
  background: string[];
  method: string;
  datasetOrSample?: string;
  authorsLine?: string;
  claims: ModelClaim[];
  numericFindings: string[];
  limitations: string[];
  implications: string[];
  confusingTerms: string[];
  skepticalQuestions: string[];
  sourceCoverage: SourceCoverage[];
  sourceNames: string[];
  wordCount: number;
};

export type BeatPurpose =
  | "hook"
  | "context"
  | "thesis"
  | "method"
  | "finding"
  | "evidence"
  | "skepticism"
  | "limitation"
  | "implication"
  | "recap";

export type PlanBeat = {
  id: string;
  role: BeatRole;
  purpose: BeatPurpose;
  title: string;
  goal: string;
  intent: string;
  claimId?: string;
  claimIds: string[];
  evidenceIds: string[];
  listenerQuestion: string;
  tone: "curious" | "careful" | "skeptical" | "excited" | "serious";
  talkingPoints: string[];
  quote?: string;
};

export type EpisodePlan = {
  title: string;
  episodeTitle: string;
  logline: string;
  style: EpisodeStyle;
  targetDurationMinutes: number;
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
  evidenceIds?: string[];
  performance?: {
    pauseBeforeMs?: number;
    emotion?: "neutral" | "curious" | "skeptical" | "warm" | "serious";
    rate?: number;
    pitch?: number;
    emphasis?: string[];
  };
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
  evaluation: BenchmarkResult;
  engine: EngineInfo;
  options: EpisodeOptions;
};

export type ScriptIssueType =
  | "repetition"
  | "unsupported_claim"
  | "missing_method"
  | "missing_limitations"
  | "robotic_phrase"
  | "weak_transition"
  | "too_extractive"
  | "too_verbose";

export type ScriptIssue = {
  severity: "low" | "medium" | "high";
  type: ScriptIssueType;
  message: string;
  lineIds?: string[];
};

export type ScriptScores = {
  understanding: number;
  sourceGrounding: number;
  methodCoverage: number;
  findingsCoverage: number;
  limitationsCoverage: number;
  nonRepetition: number;
  conversationalQuality: number;
  structure: number;
  usefulness: number;
  overall: number;
};

export type ScriptCritiqueResult = {
  script: PodcastScript;
  issues: ScriptIssue[];
  scores: ScriptScores;
};

export type BenchmarkResult = {
  id: string;
  createdAt: string;
  documentName: string;
  generatorProvider: string;
  judgeProvider: string;
  judgeModel?: string;
  options: EpisodeOptions;
  scores: ScriptScores;
  issues: ScriptIssue[];
  summary: string;
  recommendations: string[];
  scriptWordCount: number;
  repeatedPhrases: string[];
  unsupportedClaims: string[];
  missingCoverage: string[];
};

export type JudgeKind = "ollama" | "rules";

export type UploadItem = {
  id: string;
  file: File;
  status: "queued" | "reading" | "ready" | "error";
  error?: string;
  doc?: ExtractedDoc;
};

export const HOSTS: Record<HostId, { name: string; role: string; short: string }> = {
  maya: { name: "Maya Reed", role: "Curious host", short: "Maya" },
  jordan: { name: "Jordan Hale", role: "Research explainer", short: "Jordan" },
};

export const PIPELINE_STAGES: { id: PipelineStage; label: string }[] = [
  { id: "extract", label: "ExtractedPaper" },
  { id: "model", label: "PaperModel" },
  { id: "plan", label: "EpisodePlan" },
  { id: "script", label: "Script" },
  { id: "critique", label: "Critique" },
  { id: "benchmark", label: "Benchmark" },
];
