export const OLLAMA_URL = "http://localhost:11434";

export type OllamaStatus =
  | { available: false; reason: string }
  | { available: true; model: string };

const PREFERRED = [
  "llama3.2",
  "llama3.1",
  "llama3",
  "qwen2.5",
  "qwen2",
  "mistral",
  "phi3",
  "gemma2",
  "gemma",
];

type FetchLike = typeof fetch;

export function pickOllamaModel(names: string[]): string | undefined {
  const lower = names.map((n) => n.toLowerCase());
  for (const pref of PREFERRED) {
    const hit = names.find((n, i) => lower[i] === pref || lower[i].startsWith(`${pref}:`));
    if (hit) return hit;
  }
  return names[0];
}

async function withTimeout(ms: number, work: (signal: AbortSignal) => Promise<Response>): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await work(ctrl.signal);
  } finally {
    clearTimeout(t);
  }
}

export async function probeOllama(options?: {
  baseUrl?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}): Promise<OllamaStatus> {
  const baseUrl = options?.baseUrl ?? OLLAMA_URL;
  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? 1500;
  try {
    const res = await withTimeout(timeoutMs, (signal) =>
      fetchImpl(`${baseUrl.replace(/\/$/, "")}/api/tags`, { signal, cache: "no-store" })
    );
    if (!res.ok) return { available: false, reason: `Ollama returned HTTP ${res.status}.` };
    const data = (await res.json()) as { models?: { name?: string }[] };
    const names = (data.models ?? []).map((m) => m.name).filter((n): n is string => Boolean(n));
    const model = pickOllamaModel(names);
    if (!model) return { available: false, reason: "Ollama is up but has no models pulled." };
    return { available: true, model };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      available: false,
      reason: aborted ? "Ollama probe timed out." : "Ollama is not running at localhost:11434.",
    };
  }
}

export async function ollamaJson<T>(options: {
  prompt: string;
  model: string;
  baseUrl?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}): Promise<T | null> {
  const baseUrl = options.baseUrl ?? OLLAMA_URL;
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const res = await withTimeout(options.timeoutMs ?? 20000, (signal) =>
      fetchImpl(`${baseUrl.replace(/\/$/, "")}/api/chat`, {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: options.model,
          stream: false,
          format: "json",
          messages: [
            {
              role: "system",
              content:
                "You write structured JSON for a local paper-to-podcast booth. Never copy twelve or more consecutive words from evidence quotes into spoken text.",
            },
            { role: "user", content: options.prompt },
          ],
        }),
      })
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { message?: { content?: string } };
    const raw = data.message?.content?.trim();
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export type LlmScriptLine = {
  host: "maya" | "jordan";
  text: string;
  beatId: string;
  claimId?: string;
  quote?: string;
};

export function buildScriptPrompt(input: {
  thesis: string;
  beats: { id: string; role: string; intent: string; claimId?: string; talkingPoints: string[]; quote?: string }[];
  claims: { id: string; kind: string; text: string; numbers: string[] }[];
}): string {
  return `Write a two-host podcast from this episode plan and paper model. Maya asks; Jordan answers from claim.text, never from raw evidence.
Return {"lines":[{"host":"maya"|"jordan","text":string,"beatId":string,"claimId"?:string,"quote"?:string}]}
Thesis: ${input.thesis}
Claims: ${JSON.stringify(input.claims)}
Beats: ${JSON.stringify(input.beats)}`;
}

export function parseLlmScript(payload: { lines?: LlmScriptLine[] } | null): LlmScriptLine[] | null {
  const lines = payload?.lines;
  if (!Array.isArray(lines) || lines.length < 8) return null;
  if (!lines.every((l) => (l.host === "maya" || l.host === "jordan") && typeof l.text === "string" && l.beatId)) {
    return null;
  }
  return lines;
}

export async function tryOllamaScript(input: {
  modelName: string;
  thesis: string;
  beats: { id: string; role: string; intent: string; claimId?: string; talkingPoints: string[]; quote?: string }[];
  claims: { id: string; kind: string; text: string; numbers: string[] }[];
  fetchImpl?: FetchLike;
  baseUrl?: string;
}): Promise<LlmScriptLine[] | null> {
  const payload = await ollamaJson<{ lines?: LlmScriptLine[] }>({
    model: input.modelName,
    fetchImpl: input.fetchImpl,
    baseUrl: input.baseUrl,
    prompt: buildScriptPrompt(input),
  });
  return parseLlmScript(payload);
}
