import { NextResponse } from "next/server";
import { produceEpisode } from "@/lib/pipeline";
import type { EpisodeOptions, ExtractedDoc, JudgeKind } from "@/lib/types";
import { DEFAULT_EPISODE_OPTIONS } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  docs?: ExtractedDoc[];
  options?: Partial<EpisodeOptions>;
  judge?: JudgeKind;
  judgeModel?: string;
  preferredModel?: string;
  forceRules?: boolean;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, reason: "Expected JSON body." }, { status: 400 });
  }
  const docs = (body.docs ?? []).filter((d) => d?.text && d.name);
  if (!docs.length) {
    return NextResponse.json(
      { ok: false, reason: "Send extracted docs: [{ id, name, kind, text, wordCount }]." },
      { status: 400 }
    );
  }

  const options: EpisodeOptions = {
    ...DEFAULT_EPISODE_OPTIONS,
    ...body.options,
  };

  try {
    const result = await produceEpisode(docs, {
      episode: options,
      judge: body.judge ?? "rules",
      judgeModel: body.judgeModel,
      preferredModel: body.preferredModel,
      forceRules: body.forceRules ?? body.judge === "rules",
    });
    return NextResponse.json({
      ok: true,
      evaluation: result.evaluation,
      engine: result.engine,
      scriptWordCount: result.script.wordCount,
      thesis: result.model.thesis,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, reason: err instanceof Error ? err.message : "Benchmark failed." },
      { status: 500 }
    );
  }
}
