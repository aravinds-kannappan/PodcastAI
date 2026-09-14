import { NextResponse } from "next/server";
import { ollamaJson, probeOllama } from "@/lib/ollama";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const status = await probeOllama();
  return NextResponse.json(status);
}

export async function POST(request: Request) {
  const status = await probeOllama();
  if (!status.available) {
    return NextResponse.json({ ok: false, ...status }, { status: 503 });
  }
  let prompt = "";
  try {
    const body = (await request.json()) as { prompt?: string };
    prompt = body.prompt?.trim() ?? "";
  } catch {
    return NextResponse.json({ ok: false, reason: "Expected JSON { prompt }." }, { status: 400 });
  }
  if (!prompt) {
    return NextResponse.json({ ok: false, reason: "Missing prompt." }, { status: 400 });
  }
  const json = await ollamaJson<unknown>({ model: status.model, prompt });
  if (json == null) {
    return NextResponse.json({ ok: false, reason: "Ollama returned unusable JSON." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, model: status.model, json });
}
