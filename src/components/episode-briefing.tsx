"use client";

import { useState, type ReactNode } from "react";
import type { EpisodeResult, ModelClaim } from "@/lib/types";
import { Panel } from "@/components/choice-row";

const VIEWS = ["script", "takeaways", "claims", "evidence", "limitations"] as const;
type View = (typeof VIEWS)[number];

const LABELS: Record<View, string> = {
  script: "Script",
  takeaways: "Takeaways",
  claims: "Claims",
  evidence: "Evidence",
  limitations: "Limitations",
};

export function EpisodeBriefing({
  result,
  scriptSlot,
}: {
  result: EpisodeResult;
  scriptSlot: ReactNode;
}) {
  const [view, setView] = useState<View>("script");
  const { model, script } = result;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {VIEWS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
              view === id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-muted"
            }`}
          >
            {LABELS[id]}
          </button>
        ))}
      </div>

      {view === "script" ? scriptSlot : null}

      {view === "takeaways" ? (
        <Panel title="Listener takeaways">
          {script.takeaways.length ? (
            <ol className="flex list-decimal flex-col gap-2 pl-4 text-sm leading-relaxed">
              {script.takeaways.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ol>
          ) : (
            <Empty>No takeaways yet. Generate an episode first.</Empty>
          )}
        </Panel>
      ) : null}

      {view === "claims" ? (
        <Panel title="Modeled claims">
          <ClaimList claims={model.claims} />
        </Panel>
      ) : null}

      {view === "evidence" ? (
        <Panel title="Evidence spans">
          <ul className="flex flex-col gap-3">
            {model.claims.map((c) => (
              <li key={c.id} className="text-sm">
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  {c.kind} · {c.section}
                </p>
                <p className="mt-1 border-l-2 border-primary/30 pl-2 text-muted-foreground italic">
                  “{c.evidence}”
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {view === "limitations" ? (
        <Panel title="Limitations and caveats">
          {model.limitations.length ? (
            <ul className="flex list-disc flex-col gap-2 pl-4 text-sm leading-relaxed">
              {model.limitations.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          ) : (
            <Empty>The model did not extract a clean limitation. Try a paper with a Limitations section.</Empty>
          )}
          {model.skepticalQuestions.length ? (
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground">Skeptical questions</p>
              <ul className="mt-1 flex list-disc flex-col gap-1 pl-4 text-sm">
                {model.skepticalQuestions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </Panel>
      ) : null}
    </div>
  );
}

function ClaimList({ claims }: { claims: ModelClaim[] }) {
  if (!claims.length) return <Empty>No claims modeled.</Empty>;
  return (
    <ul className="flex flex-col gap-3">
      {claims.map((c) => (
        <li key={c.id} className="rounded-xl bg-muted/50 px-3 py-2">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {c.kind}
            {c.numbers.length ? ` · ${c.numbers.slice(0, 2).join(", ")}` : ""}
          </p>
          <p className="mt-1 text-sm leading-relaxed">{c.text}</p>
        </li>
      ))}
    </ul>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
