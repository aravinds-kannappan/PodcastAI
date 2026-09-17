import { NextResponse } from "next/server";

const CARTESIA_URL = "https://api.cartesia.ai/tts/bytes";

const VOICES: Record<string, string> = {
  maya: "79a125e8-cd45-4c13-8a67-188112f4dd22",
  jordan: "a0e99841-438c-4a64-b679-ae501e7d6091",
};

function pcmToWav(pcm: ArrayBuffer, sampleRate: number, channels = 1, bits = 16): ArrayBuffer {
  const len = pcm.byteLength;
  const buf = new ArrayBuffer(44 + len);
  const v = new DataView(buf);
  const w = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  w(0, "RIFF");
  v.setUint32(4, 36 + len, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, channels, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * channels * (bits / 8), true);
  v.setUint16(32, channels * (bits / 8), true);
  v.setUint16(34, bits, true);
  w(36, "data");
  v.setUint32(40, len, true);
  new Uint8Array(buf, 44).set(new Uint8Array(pcm));
  return buf;
}

export async function POST(req: Request) {
  const apiKey = process.env.CARTESIA_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "CARTESIA_API_KEY is not set. Add it to .env.local." },
      { status: 500 }
    );
  }

  let text: string;
  let voice: string;
  try {
    const body = (await req.json()) as { text?: string; voice?: string };
    text = body.text ?? "";
    voice = body.voice ?? "maya";
  } catch {
    return NextResponse.json({ error: "Bad request body" }, { status: 400 });
  }

  if (!text.trim()) {
    return NextResponse.json({ error: "No text provided" }, { status: 400 });
  }

  const voiceId = VOICES[voice] ?? VOICES.maya;
  const sampleRate = 24000;

  try {
    const res = await fetch(CARTESIA_URL, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Cartesia-Version": "2024-06-10",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model_id: "sonic-2",
        transcript: text,
        voice: { mode: "id", id: voiceId },
        output_format: {
          container: "raw",
          encoding: "pcm_s16le",
          sample_rate: sampleRate,
        },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Cartesia returned ${res.status}: ${detail.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const pcm = await res.arrayBuffer();
    const wav = pcmToWav(pcm, sampleRate);

    return new Response(wav, {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    const msg =
      err instanceof Error && err.name === "TimeoutError"
        ? "Cartesia request timed out."
        : err instanceof Error
          ? err.message
          : "TTS request failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  const apiKey = process.env.CARTESIA_API_KEY;
  return NextResponse.json({ available: Boolean(apiKey) });
}
