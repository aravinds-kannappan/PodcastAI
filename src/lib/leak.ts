import { wordTokens } from "./text";

/** Consecutive source words that count as reading the page aloud. */
export const LEAK_RUN = 12;

export function longestSourceRun(line: string, sentences: string[]): number {
  const dest = wordTokens(line);
  if (!dest.length) return 0;
  let best = 0;
  for (const sentence of sentences) {
    const src = wordTokens(sentence);
    if (src.length < 6) continue;
    for (let i = 0; i < src.length; i++) {
      for (let j = 0; j < dest.length; j++) {
        let k = 0;
        while (i + k < src.length && j + k < dest.length && src[i + k] === dest[j + k]) {
          k++;
        }
        if (k > best) best = k;
      }
    }
  }
  return best;
}

export function lineLeaks(line: string, sentences: string[], run = LEAK_RUN): boolean {
  return longestSourceRun(line, sentences) >= run;
}

export function sourceSentenceTexts(sentences: { text: string }[]): string[] {
  return sentences.map((s) => s.text);
}
