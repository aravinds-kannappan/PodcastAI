"use client";

import { PIPELINE_STAGES, type EpisodeResult, type PipelineStage } from "@/lib/types";

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function Meter({ label, value, invert = false }: { label: string; value: number; invert?: boolean }) {
  const shown = invert ? 1 - value : value;
  const ok = invert ? value === 0 : value >= 0.75;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={`tabular-nums font-medium ${ok ? "text-foreground" : "text-destructive"}`}>
          {pct(shown)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full ${ok ? "bg-primary" : "bg-destructive"}`}
          style={{ width: `${Math.max(4, Math.min(100, shown * 100))}%` }}
        />
      </div>
    </div>
  );
}

export function PipelineTrace({
  result,
  stage,
  busy,
}: {
  result: EpisodeResult | null;
  stage: PipelineStage | null;
  busy: boolean;
}) {
  const active = stage;
  return (
    <div className="flex flex-col gap-3">
      <ol className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {PIPELINE_STAGES.map((s, i) => {
          const done = result ? true : active ? PIPELINE_STAGES.findIndex((x) => x.id === active) > i : false;
          const current = active === s.id;
          return (
            <li
              key={s.id}
              className={`rounded-lg border px-2 py-1.5 text-[11px] leading-tight ${
                current
                  ? "border-primary bg-accent text-foreground"
                  : done
                    ? "border-border bg-card text-foreground"
                    : "border-dashed border-border text-muted-foreground"
              }`}
            >
              <span className="block font-medium tracking-wide uppercase">{i + 1}</span>
              {s.label}
            </li>
          );
        })}
      </ol>

      {busy && !result ? (
        <p className="text-xs text-muted-foreground">
          {active === "extract"
            ? "Sectioning the extracted paper."
            : active === "model"
              ? "Building claims, evidence, and a thesis."
              : active === "plan"
                ? "Planning beats from the PaperModel."
                : active === "script"
                  ? "Writing Maya and Jordan from the plan."
                  : active === "critique"
                    ? "Checking grounding and extractive leaks."
                    : "Scoring coverage, grounding, and leak rate."}
        </p>
      ) : null}

      {result ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">
              {result.engine.kind === "ollama" ? `Ollama · ${result.engine.model}` : "Rule-based booth"}
            </p>
            <span className="text-xs text-muted-foreground">
              Critique {result.critique.score}
              {result.critique.passed ? " · pass" : " · needs work"}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{result.engine.note}</p>
          <p className="text-sm leading-relaxed text-pretty">
            <span className="font-medium">Thesis. </span>
            {result.model.thesis}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Meter label="Claim coverage" value={result.benchmark.coverage} />
            <Meter label="Grounding" value={result.benchmark.grounding} />
            <Meter label="Extractive leak" value={result.benchmark.extractiveLeak} invert />
            <Meter label="Host balance" value={result.benchmark.hostBalance} />
          </div>
          {result.critique.issues.length ? (
            <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
              {result.critique.issues.slice(0, 4).map((issue, i) => (
                <li key={`${issue.code}-${i}`}>
                  {issue.severity === "error" ? "Error" : "Note"}: {issue.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              {result.model.claims.length} modeled claims · {result.plan.beats.length} planned beats ·{" "}
              {result.script.lines.length} spoken lines. Dialogue came from the plan, not the raw page.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
