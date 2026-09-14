export type {
  BenchmarkResult,
  ScriptIssue,
  ScriptScores,
  JudgeKind,
  EpisodeOptions,
} from "@/lib/types";

export const SCORE_LABELS: { key: keyof import("@/lib/types").ScriptScores; label: string }[] = [
  { key: "understanding", label: "Paper understanding" },
  { key: "sourceGrounding", label: "Source grounding" },
  { key: "methodCoverage", label: "Methods coverage" },
  { key: "findingsCoverage", label: "Key findings coverage" },
  { key: "limitationsCoverage", label: "Limitations coverage" },
  { key: "nonRepetition", label: "Non-repetition" },
  { key: "conversationalQuality", label: "Conversational naturalness" },
  { key: "structure", label: "Structure / narrative arc" },
  { key: "usefulness", label: "Usefulness for a listener" },
  { key: "overall", label: "Overall" },
];
