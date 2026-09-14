import type { ClaimKind, PaperSection } from "./types";

export const STOP = new Set(
  "a an the and or but if then so to of in on for with from by as at is are was were be been being this that these those it its their our we they you i not no yes into over under about than also can could should would may might will just than into over after before during while where when what which who whom whose how why whom because since until unless whether both each few more most other some such only own same than too very because".split(
    " "
  )
);

const FINDING =
  /\b(findings?|results?|we found|the authors found|show that|shows that|suggests? that|conclude[sd]?|evidence|significant|increase[sd]?|decrease[sd]?|predicts?|associated with|recalled|recovered)\b/i;
const METHOD =
  /\b(we (measured|surveyed|recruited|randomized|sampled|analyzed|counted|handed)|participants?|n\s*=|method|procedure|experiment|how we counted|recruited)\b/i;
const LIMIT =
  /\b(limitation|however|although|caveat|did not|cannot|unclear|future work|bias|convenient|not random|we cannot|treat this)\b/i;
const RECOMMEND =
  /\b(recommend|should|try the|practical claim|if you|assign the|cheaper intervention)\b/i;
const NUMBER = /\b\d+(?::\d+)?(?:\.\d+)?%?\b/;

export function makeId(prefix: string): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return `${prefix}-${c.randomUUID()}`;
  return `${prefix}-${Math.random().toString(36).slice(2, 12)}`;
}

export function splitSentences(text: string): string[] {
  const cleaned = text
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return [];
  return cleaned
    .split(/(?<=[.!?])\s+(?=["A-Z0-9])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 28 && !/^https?:/i.test(s));
}

export function detectTitle(text: string, fallback: string): string {
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/^#+\s*/, "").trim())
    .filter(Boolean);
  const first = lines[0] ?? fallback;
  if (first.length < 120 && first.length > 8 && !first.endsWith(".")) return first;
  const heading = lines.find((l) => l.length < 90 && /^[A-Z]/.test(l) && !l.endsWith("."));
  return heading ?? fallback.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]/g, " ");
}

export function detectAuthors(text: string): string | undefined {
  const from = text.match(/^From:\s*(.+)$/m);
  if (from?.[1]) return from[1].trim();
  const authors = text.match(
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}(?:,\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}){0,4}(?:,?\s+and\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})?)\s+--/
  );
  if (authors?.[1]) return authors[1].trim();
  return undefined;
}

export function sectionize(text: string): PaperSection[] {
  const parts = text.split(
    /\n(?=(?:#{1,3}\s+|[A-Z][A-Z ]{8,}|Abstract|Introduction|Methods?|Results?|Discussion|Conclusion|Limitations|References|Takeaway|What changed|Numbers|Recommendation|Subject:)\b)/i
  );
  const sections: PaperSection[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    const nl = trimmed.indexOf("\n");
    if (nl > 0 && nl < 90) {
      sections.push({
        heading: trimmed.slice(0, nl).replace(/^#+\s*/, "").trim(),
        body: trimmed.slice(nl + 1),
      });
    } else {
      sections.push({ heading: "Body", body: trimmed });
    }
  }
  return sections.length ? sections : [{ heading: "Body", body: text }];
}

export function classifyKind(sentence: string): ClaimKind {
  if (LIMIT.test(sentence)) return "limit";
  if (METHOD.test(sentence)) return "method";
  if (FINDING.test(sentence)) return "finding";
  if (RECOMMEND.test(sentence)) return "recommendation";
  if (NUMBER.test(sentence)) return "number";
  return "background";
}

export function scoreSentence(sentence: string, section: string, index: number): number {
  let score = 1;
  const lower = section.toLowerCase();
  if (/abstract|subject/.test(lower)) score += 6;
  if (/conclusion|discussion|takeaway/.test(lower)) score += 5;
  if (/result|what changed|numbers/.test(lower)) score += 4;
  if (/intro/.test(lower)) score += 2;
  if (/limit/.test(lower)) score += 3;
  if (/method/.test(lower)) score += 2;
  if (index === 0) score += 2;
  if (FINDING.test(sentence)) score += 4;
  if (NUMBER.test(sentence)) score += 3;
  if (LIMIT.test(sentence)) score += 2;
  if (METHOD.test(sentence)) score += 1;
  if (RECOMMEND.test(sentence)) score += 2;
  const len = sentence.length;
  if (len > 70 && len < 280) score += 2;
  if (len < 40) score -= 3;
  if (len > 420) score -= 2;
  if (/\b(doi:|copyright|all rights|http|www\.)/i.test(sentence)) score -= 8;
  if (/^references\b/i.test(section)) score -= 10;
  return score;
}

export function wordTokens(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9']+/g) ?? []).filter(Boolean);
}

export function contentTokens(s: string): string[] {
  return wordTokens(s).filter((w) => w.length > 2 && !STOP.has(w));
}

export function tokenSet(s: string): Set<string> {
  return new Set(contentTokens(s));
}

export function overlap(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n / Math.min(a.size, b.size);
}

export function extractNumbers(sentence: string): string[] {
  const found = sentence.match(
    /\b\d+(?::\d+)?(?:\.\d+)?%?(?:\s*(?:percent|per hour|minutes?|points?|hours?|weeks?|days?))?\b/gi
  );
  if (!found) return [];
  const uniq: string[] = [];
  for (const n of found.map((x) => x.replace(/\s+/g, " ").trim())) {
    if (!uniq.some((u) => u.toLowerCase() === n.toLowerCase())) uniq.push(n);
  }
  return uniq.slice(0, 5);
}

export function authorsVoice(s: string): string {
  return s
    .replace(/\b[Ww]e (found|show|demonstrate|argue|measure|report|propose|conclude|recruited|counted)\b/g, "the authors $1")
    .replace(/\b[Oo]ur (results|findings|data|study|experiment|sample|density measure)\b/g, "their $1")
    .replace(/\b[Tt]his (paper|study|article|work|sample|memo)\b/g, "the study")
    .replace(/\s+/g, " ")
    .trim();
}

export function clipQuote(s: string, max = 180): string {
  const clean = s.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return `${cut.slice(0, sp > 80 ? sp : max).trim()}…`;
}

export function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function lowerFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

export function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}
