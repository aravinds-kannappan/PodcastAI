"use client";

import { LocalModelStatus, type OllamaUiStatus } from "@/components/local-model-status";
import { Panel } from "@/components/choice-row";
import { Badge } from "@/components/ui/badge";
import type { EngineKind } from "@/lib/types";

type VoiceRow = { id: string; label: string; available: boolean; note: string };

export function LocalModelsTab({
  ollama,
  reasoning,
  preferredModel,
  onPreferredModel,
  voiceRows,
}: {
  ollama: OllamaUiStatus;
  reasoning: EngineKind | "auto";
  preferredModel?: string;
  onPreferredModel: (model: string) => void;
  voiceRows: VoiceRow[];
}) {
  const models = ollama.state === "connected" ? ollama.models : [];
  const selected = preferredModel ?? (ollama.state === "connected" ? ollama.model : "");

  return (
    <div className="flex flex-col gap-6">
      <section className="max-w-2xl">
        <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">Local models</p>
        <h1 className="font-heading mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Nothing leaves this machine.
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          PaperCast talks to Ollama at localhost:11434 when you have it, and to the browser’s
          SpeechSynthesis voices when you don’t. Piper, macOS say, and Coqui are stubs for later.
          No API keys. No cloud backend.
        </p>
      </section>

      <LocalModelStatus ollama={ollama} reasoning={reasoning} voice={voiceRows.find((v) => v.available)?.label ?? "None"} />

      <Panel title="Ollama">
        {ollama.state === "connected" ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              Connected. Preferred order is llama3.1, then qwen2.5, then mistral, then whatever you
              have pulled.
            </p>
            {models.length ? (
              <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                Active model
                <select
                  className="h-8 rounded-lg border border-border bg-background px-2 text-sm text-foreground"
                  value={selected}
                  onChange={(e) => onPreferredModel(e.target.value)}
                >
                  {models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <pre className="rounded-xl bg-muted p-3 text-xs leading-relaxed">
{`ollama pull llama3.1
ollama serve`}
            </pre>
          </div>
        ) : (
          <div className="flex flex-col gap-2 text-sm">
            <p>{ollama.state === "checking" ? "Checking localhost:11434…" : ollama.reason}</p>
            <p className="text-muted-foreground">
              Install Ollama, pull a model, then refresh. The Studio and Benchmark tabs keep working
              with the rule-based writer and judge until then.
            </p>
            <pre className="rounded-xl bg-muted p-3 text-xs leading-relaxed">
{`ollama pull llama3.1
ollama serve`}
            </pre>
          </div>
        )}
      </Panel>

      <Panel title="Voice providers">
        <ul className="flex flex-col gap-2">
          {voiceRows.map((row) => (
            <li
              key={row.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-border px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium">{row.label}</p>
                <p className="text-xs text-muted-foreground">{row.note}</p>
              </div>
              <Badge variant={row.available ? "secondary" : "outline"}>
                {row.available ? "Available" : "Not yet"}
              </Badge>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
