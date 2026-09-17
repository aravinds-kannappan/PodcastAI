"use client";

import { useCallback, useRef, useState } from "react";
import {
  FileText,
  Globe,
  Loader2,
  Type,
  Upload,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { classifyFile, extractDocument } from "@/lib/extract";
import type { ExtractedDoc, UploadItem } from "@/lib/types";

const ACCEPT = ".pdf,.txt,.md,.markdown,.docx,.html,.htm,.rtf,.csv,.json,.tex,.rst,.org";

type InputMode = "upload" | "paste" | "url";

type Props = {
  items: UploadItem[];
  busy: boolean;
  onChange: (items: UploadItem[]) => void;
  onExtracted: (docs: ExtractedDoc[]) => void;
};

function uid() {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

export function ContentInput({ items, busy, onChange, onExtracted }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<InputMode>("upload");
  const [drag, setDrag] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [urlValue, setUrlValue] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const ingestFiles = useCallback(
    async (files: File[]) => {
      setLocalError(null);
      const incoming = files.filter(Boolean);
      if (!incoming.length) return;
      const next: UploadItem[] = [];
      for (const file of incoming) {
        if (file.size > 25 * 1024 * 1024) {
          next.push({ id: uid(), file, status: "error", error: "Larger than 25 MB." });
          continue;
        }
        if (classifyFile(file) === "unsupported") {
          next.push({
            id: uid(),
            file,
            status: "error",
            error: "Unsupported format. Use PDF, TXT, Markdown, HTML, RTF, or DOCX.",
          });
          continue;
        }
        next.push({ id: uid(), file, status: "queued" });
      }
      const merged = [...items, ...next].slice(0, 8);
      onChange(merged);

      const working = [...merged];
      const readyDocs: ExtractedDoc[] = [];
      for (let i = 0; i < working.length; i++) {
        const item = working[i];
        if (item.status === "ready" && item.doc) {
          readyDocs.push(item.doc);
          continue;
        }
        if (item.status === "error") continue;
        working[i] = { ...item, status: "reading" };
        onChange([...working]);
        try {
          const doc = await extractDocument(item.file, item.id);
          working[i] = { ...item, status: "ready", doc };
          readyDocs.push(doc);
        } catch (err) {
          working[i] = {
            ...item,
            status: "error",
            error: err instanceof Error ? err.message : "Could not read that file.",
          };
        }
        onChange([...working]);
      }
      onExtracted(readyDocs);
    },
    [items, onChange, onExtracted]
  );

  const ingestPastedText = useCallback(() => {
    setLocalError(null);
    const text = pasteText.trim();
    if (!text) {
      setLocalError("Paste some text first.");
      return;
    }
    if (text.split(/\s+/).length < 20) {
      setLocalError("That's too short. Paste at least a few paragraphs.");
      return;
    }
    const id = uid();
    const doc: ExtractedDoc = {
      id,
      name: "Pasted text",
      kind: "text",
      text,
      wordCount: text.split(/\s+/).filter(Boolean).length,
    };
    const blob = new Blob([text], { type: "text/plain" });
    const file = new File([blob], "pasted-text.txt", { type: "text/plain" });
    const item: UploadItem = { id, file, status: "ready", doc };
    const merged = [...items, item];
    onChange(merged);
    onExtracted(merged.filter((x) => x.status === "ready" && x.doc).map((x) => x.doc as ExtractedDoc));
    setPasteText("");
  }, [pasteText, items, onChange, onExtracted]);

  const ingestUrl = useCallback(async () => {
    setLocalError(null);
    const url = urlValue.trim();
    if (!url) {
      setLocalError("Enter a URL first.");
      return;
    }
    try {
      new URL(url.startsWith("http") ? url : `https://${url}`);
    } catch {
      setLocalError("That doesn't look like a valid URL.");
      return;
    }

    setUrlLoading(true);
    try {
      const fullUrl = url.startsWith("http") ? url : `https://${url}`;
      const res = await fetch("/api/extract-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: fullUrl }),
      });
      const body = (await res.json()) as { text?: string; title?: string; wordCount?: number; error?: string };
      if (!res.ok || !body.text) {
        setLocalError(body.error ?? "Could not extract text from that URL.");
        return;
      }
      const id = uid();
      const doc: ExtractedDoc = {
        id,
        name: body.title ?? url,
        kind: "html",
        text: body.text,
        wordCount: body.wordCount ?? body.text.split(/\s+/).filter(Boolean).length,
      };
      const blob = new Blob([body.text], { type: "text/plain" });
      const file = new File([blob], `${body.title ?? "url-content"}.txt`, { type: "text/plain" });
      const item: UploadItem = { id, file, status: "ready", doc };
      const merged = [...items, item];
      onChange(merged);
      onExtracted(
        merged.filter((x) => x.status === "ready" && x.doc).map((x) => x.doc as ExtractedDoc)
      );
      setUrlValue("");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not fetch that URL.");
    } finally {
      setUrlLoading(false);
    }
  }, [urlValue, items, onChange, onExtracted]);

  const tabs: { id: InputMode; label: string; icon: typeof Upload }[] = [
    { id: "upload", label: "Upload", icon: Upload },
    { id: "paste", label: "Paste text", icon: Type },
    { id: "url", label: "From URL", icon: Globe },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setMode(t.id);
              setLocalError(null);
            }}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === t.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <t.icon className="size-3" />
            {t.label}
          </button>
        ))}
      </div>

      {mode === "upload" && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="sr-only"
            onChange={(e) => {
              void ingestFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            onDragEnter={(e) => { e.preventDefault(); setDrag(true); }}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              void ingestFiles(Array.from(e.dataTransfer.files ?? []));
            }}
            className={`flex min-h-28 flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
              drag
                ? "border-primary bg-accent"
                : "border-border bg-card hover:border-primary/50 hover:bg-accent/40"
            } disabled:opacity-50`}
          >
            <Upload className="mb-2 size-5 text-primary" />
            <span className="text-sm font-medium">Drop files or click to browse</span>
            <span className="mt-1 text-xs text-muted-foreground">
              PDF, Markdown, TXT, HTML, RTF, or DOCX
            </span>
          </button>
        </>
      )}

      {mode === "paste" && (
        <div className="flex flex-col gap-2">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            disabled={busy}
            placeholder="Paste an article, paper excerpt, notes, or any text you want turned into a podcast…"
            className="min-h-28 resize-none rounded-2xl border border-border bg-card px-4 py-3 text-sm leading-relaxed placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-50"
          />
          <Button
            type="button"
            size="sm"
            disabled={busy || !pasteText.trim()}
            onClick={ingestPastedText}
            className="self-start"
          >
            Use this text
          </Button>
        </div>
      )}

      {mode === "url" && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="url"
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              disabled={busy || urlLoading}
              placeholder="https://example.com/article"
              onKeyDown={(e) => {
                if (e.key === "Enter") void ingestUrl();
              }}
              className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-50"
            />
            <Button
              type="button"
              size="sm"
              disabled={busy || urlLoading || !urlValue.trim()}
              onClick={() => void ingestUrl()}
            >
              {urlLoading ? <Loader2 className="animate-spin" /> : <Globe className="size-3.5" />}
              Fetch
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            We'll grab the text from that page. Works best with articles and blog posts.
          </p>
        </div>
      )}

      {localError && (
        <p className="text-sm text-destructive">{localError}</p>
      )}

      {items.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2"
            >
              <FileText className="size-3.5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate text-sm">{item.file.name}</span>
              <Badge
                variant={item.status === "error" ? "destructive" : "secondary"}
                className="text-[10px]"
              >
                {item.status === "reading" ? "Reading…" : item.status === "ready" ? `${item.doc?.wordCount?.toLocaleString()} words` : item.status === "error" ? "Error" : "Queued"}
              </Badge>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const next = items.filter((x) => x.id !== item.id);
                  onChange(next);
                  onExtracted(
                    next
                      .filter((x) => x.status === "ready" && x.doc)
                      .map((x) => x.doc as ExtractedDoc)
                  );
                }}
                className="text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
