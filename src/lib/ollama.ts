export const OLLAMA_URL = "http://localhost:11434";

export type OllamaStatus =
  | { available: false; reason: string; models: string[] }
  | { available: true; model: string; models: string[] };

const PREFERRED = [
  "llama3.1",
  "llama3.2",
  "llama3",
  "qwen2.5",
  "qwen2",
  "mistral",
  "phi3",
  "gemma2",
  "gemma",
];

type FetchLike = typeof fetch;

export function pickOllamaModel(names: string[], preferred?: string): string | undefined {
  if (preferred && names.some((n) => n === preferred || n.startsWith(`${preferred}`))) {
    return names.find((n) => n === preferred || n.startsWith(`${preferred}`)) ?? preferred;
  }
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

export function parseModelJson(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? trimmed).trim();
  const start = candidate.search(/[\[{]/);
  const endObj = candidate.lastIndexOf("}");
  const endArr = candidate.lastIndexOf("]");
  const end = Math.max(endObj, endArr);
  if (start < 0 || end <= start) return null;
  const slice = candidate.slice(start, end + 1);
  const attempts = [
    slice,
    slice.replace(/,\s*([}\]])/g, "$1"),
    slice.replace(/'/g, '"'),
  ];
  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch {
      continue;
    }
  }
  return null;
}

export async function listOllamaModels(options?: {
  baseUrl?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}): Promise<{ ok: true; models: string[] } | { ok: false; reason: string; models: string[] }> {
  const baseUrl = options?.baseUrl ?? OLLAMA_URL;
  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? 1500;
  try {
    const res = await withTimeout(timeoutMs, (signal) =>
      fetchImpl(`${baseUrl.replace(/\/$/, "")}/api/tags`, { signal, cache: "no-store" })
    );
    if (!res.ok) return { ok: false, reason: `Ollama returned HTTP ${res.status}.`, models: [] };
    const data = (await res.json()) as { models?: { name?: string }[] };
    const models = (data.models ?? []).map((m) => m.name).filter((n): n is string => Boolean(n));
    return { ok: true, models };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      reason: aborted ? "Ollama probe timed out." : "Ollama is not running at localhost:11434.",
      models: [],
    };
  }
}

export async function probeOllama(options?: {
  baseUrl?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  preferredModel?: string;
}): Promise<OllamaStatus> {
  const listed = await listOllamaModels(options);
  if (!listed.ok) return { available: false, reason: listed.reason, models: [] };
  const model = pickOllamaModel(listed.models, options?.preferredModel);
  if (!model) return { available: false, reason: "Ollama is up but has no models pulled.", models: [] };
  return { available: true, model, models: listed.models };
}

export async function ollamaGenerate(options: {
  prompt: string;
  model: string;
  baseUrl?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  json?: boolean;
  system?: string;
}): Promise<{ text: string; json: unknown | null } | null> {
  const baseUrl = options.baseUrl ?? OLLAMA_URL;
  const fetchImpl = options.fetchImpl ?? fetch;
  const prompt = options.system ? `${options.system}\n\n${options.prompt}` : options.prompt;
  try {
    const res = await withTimeout(options.timeoutMs ?? 45000, (signal) =>
      fetchImpl(`${baseUrl.replace(/\/$/, "")}/api/generate`, {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: options.model,
          prompt,
          stream: false,
          ...(options.json === false ? {} : { format: "json" }),
        }),
      })
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { response?: string };
    const text = data.response?.trim() ?? "";
    if (!text) return null;
    return { text, json: parseModelJson(text) };
  } catch {
    return null;
  }
}

export async function ollamaJson<T>(options: {
  prompt: string;
  model: string;
  baseUrl?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  system?: string;
}): Promise<T | null> {
  const generated = await ollamaGenerate({ ...options, json: true });
  if (generated?.json != null) return generated.json as T;
  const baseUrl = options.baseUrl ?? OLLAMA_URL;
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const res = await withTimeout(options.timeoutMs ?? 45000, (signal) =>
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
                options.system ??
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
    return (parseModelJson(raw) as T | null) ?? (JSON.parse(raw) as T);
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
Maya is the curious host and listener advocate. Jordan is the careful research explainer.
Do not use filler: "Let's dive in", "That's fascinating", "Great point".
No line may merely restate the previous line. Ground claims in the model. Include skepticism and limitations.
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
