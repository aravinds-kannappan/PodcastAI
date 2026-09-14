import { NextResponse } from "next/server";
import { ollamaGenerate, ollamaJson, probeOllama } from "@/lib/ollama";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const status = await probeOllama();
  let prompt = "";
  let model = status.available ? status.model : "";
  let jsonMode = true;
  try {
    const body = (await request.json()) as { prompt?: string; model?: string; json?: boolean };
    prompt = body.prompt?.trim() ?? "";
    if (body.model?.trim()) model = body.model.trim();
    if (body.json === false) jsonMode = false;
  } catch {
    return NextResponse.json({ ok: false, reason: "Expected JSON { prompt, model? }." }, { status: 400 });
  }
  if (!prompt) {
    return NextResponse.json({ ok: false, reason: "Missing prompt." }, { status: 400 });
  }
  if (!status.available) {
    return NextResponse.json({ ok: false, available: false, reason: status.reason, models: status.models }, { status: 503 });
  }
  if (!model) {
    return NextResponse.json({ ok: false, reason: "Ollama is up but has no models pulled." }, { status: 503 });
  }

  const generated = await ollamaGenerate({ model, prompt, json: jsonMode });
  if (!generated) {
    const fallback = jsonMode ? await ollamaJson<unknown>({ model, prompt }) : null;
    if (fallback == null) {
      return NextResponse.json({ ok: false, reason: "Ollama returned unusable output." }, { status: 502 });
    }
    return NextResponse.json({ ok: true, model, json: fallback });
  }
  return NextResponse.json({
    ok: true,
    model,
    text: generated.text,
    json: generated.json,
  });
}
