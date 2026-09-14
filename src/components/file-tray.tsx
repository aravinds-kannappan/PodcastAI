"use client";

import { useCallback, useRef, useState } from "react";
import {
  FileText,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { classifyFile, extractDocument } from "@/lib/extract";
import type { ExtractedDoc, UploadItem } from "@/lib/types";

const ACCEPT = ".pdf,.txt,.md,.markdown,.docx,.html,.htm,.rtf,.csv,.json,.tex,.rst,.org";

type Props = {
  items: UploadItem[];
  busy: boolean;
  onChange: (items: UploadItem[]) => void;
  onExtracted: (docs: ExtractedDoc[]) => void;
};

function uid() {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

export function FileTray({ items, busy, onChange, onExtracted }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const ingest = useCallback(
    async (files: File[]) => {
      setLocalError(null);
      const incoming = files.filter(Boolean);
      if (!incoming.length) return;
      const next: UploadItem[] = [];
      for (const file of incoming) {
        if (file.size > 25 * 1024 * 1024) {
          next.push({
            id: uid(),
            file,
            status: "error",
            error: "Larger than 25 MB. Split the document or export a smaller text PDF.",
          });
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

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        onChange={(e) => {
          void ingest(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void ingest(Array.from(e.dataTransfer.files ?? []));
        }}
        className={`flex min-h-40 flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
          drag
            ? "border-primary bg-accent"
            : "border-border bg-card hover:border-primary/50 hover:bg-accent/40"
        } disabled:opacity-50`}
      >
        <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Upload className="size-5" />
        </span>
        <span className="font-heading text-base font-semibold tracking-tight">
          Drop papers, notes, or a messy export
        </span>
        <span className="mt-1 max-w-sm text-sm text-muted-foreground">
          PDF, Markdown, TXT, HTML, RTF, or DOCX. Text is extracted here in the
          browser. Nothing is uploaded to a model.
        </span>
        <span className="mt-3 text-xs font-medium text-primary">
          Click to browse, or drop files on this card
        </span>
      </button>

      {localError ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn’t add those files</AlertTitle>
          <AlertDescription>{localError}</AlertDescription>
        </Alert>
      ) : null}

      {items.length ? (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
            >
              <FileText className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{item.file.name}</p>
                  <Badge variant={item.status === "error" ? "destructive" : "secondary"}>
                    {item.status === "reading"
                      ? "Reading"
                      : item.status === "ready"
                        ? item.doc?.kind.toUpperCase()
                        : item.status === "error"
                          ? "Error"
                          : "Queued"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {item.status === "reading" ? (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 className="size-3 animate-spin" />
                      Pulling text…
                    </span>
                  ) : item.status === "ready" && item.doc ? (
                    `${item.doc.wordCount.toLocaleString()} words${
                      item.doc.pages ? ` · ${item.doc.pages} pages` : ""
                    }`
                  ) : item.error ? (
                    item.error
                  ) : (
                    `${Math.max(1, Math.round(item.file.size / 1024))} KB`
                  )}
                </p>
              </div>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                disabled={busy}
                aria-label={`Remove ${item.file.name}`}
                onClick={() => {
                  const next = items.filter((x) => x.id !== item.id);
                  onChange(next);
                  onExtracted(
                    next
                      .filter((x) => x.status === "ready" && x.doc)
                      .map((x) => x.doc as ExtractedDoc)
                  );
                }}
              >
                <X className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {items.length ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          disabled={busy}
          onClick={() => {
            onChange([]);
            onExtracted([]);
          }}
        >
          <Trash2 />
          Clear desk
        </Button>
      ) : null}
    </div>
  );
}
