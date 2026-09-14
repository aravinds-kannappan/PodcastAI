import type { ExtractedDoc } from "./types";

const TEXT_EXT = new Set([
  "txt",
  "md",
  "markdown",
  "csv",
  "json",
  "html",
  "htm",
  "rtf",
  "tex",
  "org",
  "rst",
]);

export function classifyFile(file: File): ExtractedDoc["kind"] | "unsupported" {
  const name = file.name.toLowerCase();
  const ext = name.includes(".") ? name.split(".").pop() ?? "" : "";
  const type = file.type.toLowerCase();

  if (ext === "pdf" || type === "application/pdf") return "pdf";
  if (ext === "docx" || type.includes("wordprocessingml")) return "docx";
  if (ext === "md" || ext === "markdown") return "markdown";
  if (ext === "html" || ext === "htm" || type === "text/html") return "html";
  if (TEXT_EXT.has(ext) || type.startsWith("text/")) return "text";
  return "unsupported";
}

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function stripHtml(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripRtf(raw: string): string {
  return raw
    .replace(/\\'[0-9a-fA-F]{2}/g, " ")
    .replace(/\\[a-zA-Z]+-?\d* ?/g, " ")
    .replace(/[{}]/g, " ");
}

function normalizeExtracted(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

async function extractPdf(data: ArrayBuffer): Promise<{ text: string; pages: number }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(data) });
  const pdf = await loadingTask.promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const line: string[] = [];
    for (const item of content.items) {
      if ("str" in item && item.str) line.push(item.str);
    }
    pages.push(line.join(" "));
  }

  return { text: pages.join("\n\n"), pages: pdf.numPages };
}

async function extractDocx(data: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth/mammoth.browser");
  const result = await mammoth.extractRawText({ arrayBuffer: data });
  return result.value;
}

export async function extractDocument(file: File, id: string): Promise<ExtractedDoc> {
  const kind = classifyFile(file);
  if (kind === "unsupported") {
    throw new Error(
      `“${file.name}” isn’t a format PaperCast can read. Try PDF, TXT, Markdown, HTML, RTF, or DOCX.`
    );
  }

  const buffer = await file.arrayBuffer();
  let text = "";
  let pages: number | undefined;

  if (kind === "pdf") {
    const extracted = await extractPdf(buffer);
    text = extracted.text;
    pages = extracted.pages;
  } else if (kind === "docx") {
    text = await extractDocx(buffer);
  } else {
    const raw = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    if (kind === "html") text = stripHtml(raw);
    else if (file.name.toLowerCase().endsWith(".rtf")) text = stripRtf(raw);
    else text = raw;
  }

  text = normalizeExtracted(text);
  if (countWords(text) < 8) {
    throw new Error(
      `“${file.name}” didn’t contain enough readable text. Scanned PDFs without a text layer won’t work. Export a text PDF, or try .txt or .md.`
    );
  }

  return {
    id,
    name: file.name,
    kind,
    text,
    pages,
    wordCount: countWords(text),
  };
}
