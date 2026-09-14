import { lineLeaks } from "./leak";
import {
  authorsVoice,
  capitalize,
  classifyKind,
  clipQuote,
  contentTokens,
  detectAuthors,
  detectTitle,
  extractNumbers,
  makeId,
  overlap,
  scoreSentence,
  sectionize,
  splitSentences,
  tokenSet,
  uniqueBy,
} from "./text";
import type {
  ClaimKind,
  ExtractedDoc,
  ExtractedPaper,
  ModelClaim,
  PaperModel,
  SourceSentence,
} from "./types";

function gistFromSentence(sentence: string, kind: ClaimKind, numbers: string[]): string {
  const content = uniqueBy(contentTokens(sentence), (w) => w).slice(0, 8);
  const head = content.slice(0, 3).join(" ");
  const tail = content.slice(3, 7).join(" ");
  const num = numbers.length ? numbers.slice(0, 3).join(" / ") : "";

  switch (kind) {
    case "finding":
      return num
        ? `${capitalize(head || "the authors")} showed ${num}${tail ? ` across ${tail}` : ""}.`
        : `The headline result concerns ${content.slice(0, 5).join(", ") || "the measured outcome"}.`;
    case "method":
      return num
        ? `The setup counted ${num} using ${content.slice(0, 5).join(", ") || "the reported protocol"}.`
        : `Measurement used ${content.slice(0, 6).join(", ") || "the reported protocol"}.`;
    case "limit":
      return `Treat the result as bounded: ${content.slice(0, 6).join(", ") || "sample and design limits"}${num ? ` (${num})` : ""}.`;
    case "number":
      return num
        ? `The figure on the page is ${num}, tied to ${tail || head || "the comparison"}.`
        : `A numeric comparison sits on ${content.slice(0, 5).join(", ")}.`;
    case "recommendation":
      return `The practical move they argue for: ${content.slice(0, 6).join(" ") || "change the environment, not the reader"}.`;
    default:
      return `Context: ${content.slice(0, 6).join(", ") || authorsVoice(sentence).slice(0, 80)}.`;
  }
}

function ensureGistDoesNotLeak(gist: string, evidence: string, kind: ClaimKind, numbers: string[]): string {
  if (!lineLeaks(gist, [evidence], 8)) return gist;
  const content = uniqueBy(contentTokens(evidence), (w) => w).slice(0, 5).join(", ");
  const num = numbers.slice(0, 3).join(" / ");
  const fallback =
    kind === "finding"
      ? `A directional result${num ? ` (${num})` : ""} on ${content || "the measured outcome"}.`
      : kind === "method"
        ? `They measured ${content || "the sample"}${num ? ` at ${num}` : ""}.`
        : kind === "limit"
          ? `A real constraint on ${content || "generalization"}.`
          : kind === "recommendation"
            ? `They want a workplace change around ${content || "interruption"}.`
            : `A supporting point on ${content || "the topic"}${num ? `: ${num}` : ""}.`;
  return fallback;
}

export function toExtractedPaper(doc: ExtractedDoc): ExtractedPaper {
  const sections = sectionize(doc.text);
  const sentences: SourceSentence[] = [];
  let order = 0;
  for (const section of sections) {
    for (const text of splitSentences(section.body)) {
      sentences.push({
        id: makeId("s"),
        text,
        section: section.heading,
        order: order++,
      });
    }
  }
  return {
    ...doc,
    title: detectTitle(doc.text, doc.name),
    sections,
    sentences,
  };
}

function pickClaims(paper: ExtractedPaper, budget: number): ModelClaim[] {
  const ranked = paper.sentences
    .map((s) => ({
      sentence: s,
      kind: classifyKind(s.text),
      salience: scoreSentence(s.text, s.section, s.order),
    }))
    .filter((row) => row.salience >= 2)
    .sort((a, b) => b.salience - a.salience);

  const chosen: ModelClaim[] = [];
  const kinds = new Map<ClaimKind, number>();

  for (const row of ranked) {
    const tokens = tokenSet(row.sentence.text);
    if (chosen.some((c) => overlap(tokens, tokenSet(c.evidence)) > 0.62)) continue;
    const already = kinds.get(row.kind) ?? 0;
    if (already >= 3 && row.kind === "background") continue;
    const numbers = extractNumbers(row.sentence.text);
    const text = ensureGistDoesNotLeak(
      gistFromSentence(row.sentence.text, row.kind, numbers),
      row.sentence.text,
      row.kind,
      numbers
    );
    chosen.push({
      id: makeId("claim"),
      kind: row.kind,
      text,
      evidence: clipQuote(row.sentence.text, 280),
      section: row.sentence.section,
      sourceName: paper.name,
      salience: row.salience,
      numbers,
    });
    kinds.set(row.kind, already + 1);
    if (chosen.length >= budget) break;
  }

  chosen.sort((a, b) => {
    const order = (k: ClaimKind) =>
      k === "finding" ? 0 : k === "method" ? 1 : k === "number" ? 2 : k === "limit" ? 3 : k === "recommendation" ? 4 : 5;
    return order(a.kind) - order(b.kind) || b.salience - a.salience;
  });
  return chosen;
}

function thesisFrom(claims: ModelClaim[], title: string): string {
  const finding = claims.find((c) => c.kind === "finding") ?? claims[0];
  if (!finding) return `${title} is a document worth walking through, claim by claim.`;
  return `${title}: ${finding.text.replace(/\.$/, "")}.`;
}

export function buildPaperModel(papers: ExtractedPaper[]): PaperModel {
  if (!papers.length) {
    throw new Error("Add at least one document before generating a show.");
  }
  const perDoc = papers.length === 1 ? 9 : Math.max(4, Math.round(10 / papers.length));
  const claims = papers.flatMap((p) => pickClaims(p, perDoc));
  if (claims.length < 2) {
    throw new Error(
      "There wasn’t enough extractable prose to model the paper. Try a longer document with full sentences."
    );
  }
  const title =
    papers.length === 1 ? papers[0].title : `${papers[0].title}, and ${papers.length - 1} more`;
  const authorsLine = papers.map((p) => detectAuthors(p.text)).find(Boolean);
  return {
    title,
    thesis: thesisFrom(claims, papers[0].title),
    authorsLine,
    claims,
    sourceNames: papers.map((p) => p.name),
    wordCount: papers.reduce((n, p) => n + p.wordCount, 0),
  };
}
