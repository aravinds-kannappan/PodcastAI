"use client";

import type { ReactNode } from "react";
import { AudioLines, Brain, Circle, Cpu } from "lucide-react";
import type { EngineKind } from "@/lib/types";

export type OllamaUiStatus =
  | { state: "checking" }
  | { state: "connected"; model: string; models: string[] }
  | { state: "unavailable"; reason: string };

export function LocalModelStatus({
  ollama,
  reasoning,
  voice,
}: {
  ollama: OllamaUiStatus;
  reasoning: EngineKind | "auto";
  voice: string;
}) {
  return (
    <dl className="grid gap-2 sm:grid-cols-3">
      <StatusChip
        icon={<Cpu className="size-3.5" />}
        label="Ollama"
        value={
          ollama.state === "checking"
            ? "Checking…"
            : ollama.state === "connected"
              ? `Connected · ${ollama.model}`
              : "Unavailable"
        }
        ok={ollama.state === "connected"}
        pending={ollama.state === "checking"}
      />
      <StatusChip
        icon={<Brain className="size-3.5" />}
        label="Reasoning"
        value={reasoning === "ollama" ? "Ollama" : reasoning === "rules" ? "Rule-based" : "Auto"}
        ok={reasoning !== "rules" ? ollama.state === "connected" : true}
      />
      <StatusChip icon={<AudioLines className="size-3.5" />} label="Voice" value={voice} ok />
    </dl>
  );
}

function StatusChip({
  icon,
  label,
  value,
  ok,
  pending,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  ok: boolean;
  pending?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-border bg-card px-3 py-2">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Circle
            className={`size-2 ${
              pending ? "fill-muted-foreground text-muted-foreground" : ok ? "fill-emerald-600 text-emerald-600" : "fill-destructive text-destructive"
            }`}
          />
          <span className="truncate">{value}</span>
        </p>
      </div>
    </div>
  );
}
