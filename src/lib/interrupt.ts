import { makeId } from "./text";
import type { PaperModel, ScriptLine } from "./types";

export type InterruptContext = {
  question: string;
  model: PaperModel;
  recentLines: ScriptLine[];
};

function findRelevantClaims(question: string, model: PaperModel) {
  const qWords = new Set(
    question
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
  return model.claims
    .map((c) => {
      const haystack = `${c.text} ${c.evidence}`.toLowerCase();
      let score = 0;
      for (const w of qWords) {
        if (haystack.includes(w)) score++;
      }
      return { claim: c, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.claim);
}

export function generateRuleInterrupt(ctx: InterruptContext): ScriptLine[] {
  const relevant = findRelevantClaims(ctx.question, ctx.model);

  const mayaLine: ScriptLine = {
    id: makeId("int"),
    host: "maya",
    text: `Hold on — I want to ask about that. ${ctx.question}`,
  };

  if (!relevant.length) {
    const fallback = ctx.model.thesis
      ? `The paper doesn't speak to that directly, but here's what we do know: ${ctx.model.thesis}`
      : "That's a fair point. The paper doesn't directly address it, but let's see what else comes up.";
    return [
      mayaLine,
      {
        id: makeId("int"),
        host: "jordan",
        text: fallback,
      },
      {
        id: makeId("int"),
        host: "maya",
        text: "Got it. Let's keep going.",
      },
    ];
  }

  const primary = relevant[0];
  const extra =
    relevant.length > 1 ? ` And there's more — ${relevant[1].text.toLowerCase()}` : "";

  return [
    mayaLine,
    {
      id: makeId("int"),
      host: "jordan",
      text: `Good question. Based on this paper: ${primary.text}${extra}`,
      claimId: primary.id,
    },
    {
      id: makeId("int"),
      host: "maya",
      text: "That makes sense. Back to where we were.",
    },
  ];
}

export async function generateInterrupt(
  ctx: InterruptContext,
  options: {
    ollamaAvailable: boolean;
    preferredModel?: string;
  }
): Promise<ScriptLine[]> {
  if (!options.ollamaAvailable) {
    return generateRuleInterrupt(ctx);
  }

  try {
    const relevant = findRelevantClaims(ctx.question, ctx.model);
    const claimsContext = (relevant.length ? relevant : ctx.model.claims.slice(0, 5))
      .map((c) => `- ${c.text} (evidence: ${c.evidence.slice(0, 120)})`)
      .join("\n");

    const prompt = `You write dialogue for a two-host podcast. Maya is the curious host. Jordan is the research explainer.
The listener interrupted with: "${ctx.question}"
Paper thesis: ${ctx.model.thesis}
Recent lines:
${ctx.recentLines
  .slice(-3)
  .map((l) => `${l.host}: ${l.text}`)
  .join("\n")}
Relevant claims:
${claimsContext}

Write 2-3 lines where Maya acknowledges the question and Jordan answers from the paper. Keep it concise.
Return JSON: {"lines":[{"host":"maya"|"jordan","text":string}]}`;

    const res = await fetch("/api/ollama/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        model: options.preferredModel,
      }),
    });

    if (!res.ok) return generateRuleInterrupt(ctx);

    const body = (await res.json()) as {
      json?: { lines?: { host: string; text: string }[] };
    };
    const lines = body.json?.lines;
    if (!Array.isArray(lines) || lines.length < 2) {
      return generateRuleInterrupt(ctx);
    }

    return lines.map((l) => ({
      id: makeId("int"),
      host: (l.host === "maya" ? "maya" : "jordan") as "maya" | "jordan",
      text: l.text,
    }));
  } catch {
    return generateRuleInterrupt(ctx);
  }
}
