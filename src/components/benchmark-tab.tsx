"use client";

import { Download, FlaskConical, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChoiceRow, Panel } from "@/components/choice-row";
import type { OllamaUiStatus } from "@/components/local-model-status";
import { SCORE_LABELS } from "@/lib/benchmark/types";
import type { BenchmarkResult, ExtractedDoc, JudgeKind, ScriptIssue } from "@/lib/types";

const HEURISTIC_NOTE =
  "Ollama judging runs locally. Scores are heuristic and should be used for iteration, not as objective truth.";

export function BenchmarkTab({
  ollama,
  docs,
  judge,
  judgeModel,
  onJudgeChange,
  onJudgeModelChange,
  result,
  busy,
  error,
  onRunSamples,
  onRunCurrent,
}: {
  ollama: OllamaUiStatus;
  docs: ExtractedDoc[];
  judge: JudgeKind;
  judgeModel?: string;
  onJudgeChange: (judge: JudgeKind) => void;
  onJudgeModelChange: (model: string) => void;
  result: BenchmarkResult | null;
  busy: boolean;
  error: string | null;
  onRunSamples: () => void;
  onRunCurrent: () => void;
}) {
  const models = ollama.state === "connected" ? ollama.models : [];
  const selected = judgeModel ?? (ollama.state === "connected" ? ollama.model : undefined);

  return (
    <div className="flex flex-col gap-6">
      <section className="max-w-2xl">
        <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">Evaluation desk</p>
        <h1 className="font-heading mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Benchmark the episode, not the vibe.
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Run the PaperModel loop on bundled samples or the file on the Studio desk. A local judge
          scores understanding, grounding, coverage, repetition, and whether Maya and Jordan actually
          explained the paper.
        </p>
      </section>

      <Panel title="Judge">
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            {ollama.state === "checking"
              ? "Checking Ollama at localhost:11434…"
              : ollama.state === "connected"
                ? `Ollama is connected with ${ollama.models.length} local model${ollama.models.length === 1 ? "" : "s"}.`
                : ollama.reason}
          </p>
          <ChoiceRow
            label="Judge"
            value={judge}
            onChange={onJudgeChange}
            disabled={busy}
            options={[
              {
                id: "ollama",
                label: ollama.state === "connected" ? "Ollama" : "Ollama (unavailable)",
              },
              { id: "rules", label: "Rule-based fallback" },
            ]}
          />
          {models.length > 1 ? (
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Judge model
              <select
                className="h-8 rounded-lg border border-border bg-background px-2 text-sm text-foreground"
                value={selected}
                disabled={busy || judge !== "ollama"}
                onChange={(e) => onJudgeModelChange(e.target.value)}
              >
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          ) : selected ? (
            <p className="text-xs text-muted-foreground">Using {selected}</p>
          ) : null}
          <p className="text-xs leading-relaxed text-muted-foreground">{HEURISTIC_NOTE}</p>
        </div>
      </Panel>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" size="lg" className="flex-1" disabled={busy} onClick={onRunSamples}>
          {busy ? <Loader2 className="animate-spin" /> : <FlaskConical />}
          Run sample benchmark
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="flex-1"
          disabled={busy || docs.length === 0}
          onClick={onRunCurrent}
        >
          {busy ? <Loader2 className="animate-spin" /> : <FlaskConical />}
          Run on current upload
        </Button>
      </div>
      {docs.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Upload a paper in Studio to benchmark the current desk, or run the bundled sample stack.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Current desk: {docs.map((d) => d.name).join(", ")}
        </p>
      )}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Benchmark stalled</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {busy && !result ? (
        <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="font-heading mt-4 text-lg font-semibold">Scoring the loop</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Extract → PaperModel → plan → write → critique → judge. This stays on your machine.
          </p>
        </div>
      ) : null}

      {!busy && !result && !error ? (
        <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
          <p className="font-heading text-lg font-semibold">No scores yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Run the sample stack for a baseline, or judge the paper currently on the Studio desk.
          </p>
        </div>
      ) : null}

      {result ? <BenchmarkDashboard result={result} /> : null}
    </div>
  );
}

function BenchmarkDashboard({ result }: { result: BenchmarkResult }) {
  const bySeverity = {
    high: result.issues.filter((i) => i.severity === "high"),
    medium: result.issues.filter((i) => i.severity === "medium"),
    low: result.issues.filter((i) => i.severity === "low"),
  };
  const grid = SCORE_LABELS.filter((s) => s.key !== "overall");

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-foreground px-4 py-5 text-background sm:px-6">
        <p className="text-[11px] font-medium tracking-[0.18em] text-background/60 uppercase">Overall score</p>
        <p className="font-heading mt-1 text-5xl font-semibold tabular-nums">{result.scores.overall}</p>
        <p className="mt-2 max-w-2xl text-sm text-background/75">{result.summary}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-background/60">
          <span>{result.documentName}</span>
          <span>·</span>
          <span>Generator {result.generatorProvider}</span>
          <span>·</span>
          <span>
            Judge {result.judgeProvider}
            {result.judgeModel ? ` · ${result.judgeModel}` : ""}
          </span>
          <span>·</span>
          <span>{result.scriptWordCount} words</span>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {grid.map((row) => (
          <ScoreCell key={row.key} label={row.label} value={result.scores[row.key]} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Issues by severity">
          <SeverityBlock label="High" items={bySeverity.high} />
          <SeverityBlock label="Medium" items={bySeverity.medium} />
          <SeverityBlock label="Low" items={bySeverity.low} />
          {!result.issues.length ? (
            <p className="text-sm text-muted-foreground">No issues flagged on this pass.</p>
          ) : null}
        </Panel>
        <Panel title="Recommendations">
          <ul className="flex list-disc flex-col gap-2 pl-4 text-sm leading-relaxed">
            {result.recommendations.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Repeated phrases">
          {result.repeatedPhrases.length ? (
            <ul className="flex flex-col gap-1">
              {result.repeatedPhrases.map((p) => (
                <li key={p} className="rounded-lg bg-muted/70 px-2 py-1 font-mono text-xs">
                  {p}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No repeated 4-grams above the threshold.</p>
          )}
        </Panel>
        <Panel title="Missing coverage">
          {result.missingCoverage.length ? (
            <div className="flex flex-wrap gap-1.5">
              {result.missingCoverage.map((m) => (
                <Badge key={m} variant="outline">
                  {m}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Methods, findings, and limitations that exist in the model were voiced.</p>
          )}
          {result.unsupportedClaims.length ? (
            <ul className="mt-3 flex list-disc flex-col gap-1 pl-4 text-sm text-muted-foreground">
              {result.unsupportedClaims.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          ) : null}
        </Panel>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{HEURISTIC_NOTE}</p>
        <Button type="button" size="sm" variant="outline" onClick={() => exportJson(result)}>
          <Download />
          Export JSON
        </Button>
      </div>

      <details className="rounded-2xl border border-border bg-card p-4">
        <summary className="cursor-pointer text-sm font-medium">Raw JSON</summary>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-muted p-3 text-[11px] leading-relaxed">
          {JSON.stringify(result, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function ScoreCell({ label, value }: { label: string; value: number }) {
  const ok = value >= 70;
  return (
    <div className="rounded-2xl border border-border bg-card px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-lg font-semibold tabular-nums ${ok ? "text-foreground" : "text-destructive"}`}>{value}</p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full ${ok ? "bg-primary" : "bg-destructive"}`}
          style={{ width: `${Math.max(4, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

function SeverityBlock({ label, items }: { label: string; items: ScriptIssue[] }) {
  if (!items.length) return null;
  return (
    <div className="mb-3">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label} · {items.length}
      </p>
      <ul className="mt-1 flex flex-col gap-1 text-sm">
        {items.map((issue, i) => (
          <li key={`${issue.type}-${i}`}>
            <span className="font-medium">{issue.type.replace(/_/g, " ")}</span>
            {": "}
            {issue.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

function exportJson(result: BenchmarkResult) {
  const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `papercast-benchmark-${result.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
