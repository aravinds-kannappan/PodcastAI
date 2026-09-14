import { NextResponse } from "next/server";
import { pickOllamaModel, probeOllama } from "@/lib/ollama";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const preferred = url.searchParams.get("model") ?? undefined;
  const status = await probeOllama({ preferredModel: preferred ?? undefined });
  if (!status.available) {
    return NextResponse.json({
      available: false,
      reason: status.reason,
      models: status.models,
      preferred: pickOllamaModel(status.models, preferred ?? undefined),
    });
  }
  return NextResponse.json({
    available: true,
    model: status.model,
    models: status.models,
    preferred: status.model,
  });
}
