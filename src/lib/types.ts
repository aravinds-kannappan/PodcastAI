export type HostId = "maya" | "jordan";

export type ExtractedDoc = {
  id: string;
  name: string;
  kind: "pdf" | "text" | "markdown" | "docx" | "html" | "other";
  text: string;
  pages?: number;
  wordCount: number;
};

export type ScriptLine = {
  id: string;
  host: HostId;
  text: string;
  quote?: string;
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

export type UploadItem = {
  id: string;
  file: File;
  status: "queued" | "reading" | "ready" | "error";
  error?: string;
  doc?: ExtractedDoc;
};

export const HOSTS: Record<
  HostId,
  { name: string; role: string; short: string }
> = {
  maya: { name: "Maya Reed", role: "Host", short: "Maya" },
  jordan: { name: "Jordan Hale", role: "Reader", short: "Jordan" },
};
