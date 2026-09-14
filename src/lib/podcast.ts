import type { ExtractedDoc, HostId, PodcastScript, ScriptLine } from "./types";

const STOP = new Set(
  "a an the and or but if then so to of in on for with from by as at is are was were be been being this that these those it its their our we they you i not no yes into over under about than also can could should would may might will just".split(
    " "
  )
);

const FINDING =
  /\b(findings?|results?|we found|the authors found|show that|shows that|suggests? that|conclude[sd]?|evidence|significant|increase[sd]?|decrease[sd]?|predicts?|associated with)\b/i;
const METHOD =
  /\b(we (measured|surveyed|recruited|randomized|sampled|analyzed)|participants?|n\s*=|method|procedure|experiment)\b/i;
const LIMIT =
  /\b(limitation|however|although|caveat|did not|cannot|unclear|future work|bias)\b/i;
const NUMBER = /\b\d+(\.\d+)?%?\b/;

type Sentence = {
  text: string;
  section: string;
  docName: string;
  score: number;
  order: number;
  kind: "finding" | "method" | "limit" | "number" | "claim";
};

function splitSentences(text: string): string[] {
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

function detectTitle(doc: ExtractedDoc): string {
  const lines = doc.text
    .split(/\n+/)
    .map((l) => l.replace(/^#+\s*/, "").trim())
    .filter(Boolean);
  const first = lines[0] ?? doc.name;
  if (first.length < 120 && first.length > 8 && !first.endsWith(".")) return first;
  const heading = lines.find((l) => l.length < 90 && /^[A-Z]/.test(l) && !l.endsWith("."));
  return heading ?? doc.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]/g, " ");
}

function sectionize(text: string): { heading: string; body: string }[] {
  const parts = text.split(/\n(?=(?:#{1,3}\s+|[A-Z][A-Z ]{8,}|Abstract|Introduction|Methods?|Results?|Discussion|Conclusion|Limitations|References)\b)/i);
  const sections: { heading: string; body: string }[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    const nl = trimmed.indexOf("\n");
    if (nl > 0 && nl < 80) {
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

function classify(sentence: string): Sentence["kind"] {
  if (FINDING.test(sentence)) return "finding";
  if (LIMIT.test(sentence)) return "limit";
  if (METHOD.test(sentence)) return "method";
  if (NUMBER.test(sentence)) return "number";
  return "claim";
}

function scoreSentence(sentence: string, section: string, index: number): number {
  let score = 1;
  const lower = section.toLowerCase();
  if (/abstract/.test(lower)) score += 6;
  if (/conclusion|discussion/.test(lower)) score += 5;
  if (/result/.test(lower)) score += 4;
  if (/intro/.test(lower)) score += 2;
  if (index === 0) score += 2;
  if (FINDING.test(sentence)) score += 4;
  if (NUMBER.test(sentence)) score += 3;
  if (LIMIT.test(sentence)) score += 2;
  if (METHOD.test(sentence)) score += 1;
  const len = sentence.length;
  if (len > 70 && len < 280) score += 2;
  if (len < 40) score -= 3;
  if (len > 420) score -= 2;
  if (/\b(doi:|copyright|all rights|http|www\.)/i.test(sentence)) score -= 8;
  if (/^references\b/i.test(section)) score -= 10;
  return score;
}

function tokenSet(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
  );
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n / Math.min(a.size, b.size);
}

function pickSentences(docs: ExtractedDoc[], perDoc: number): Sentence[] {
  const picked: Sentence[] = [];
  for (const doc of docs) {
    const candidates: Sentence[] = [];
    let order = 0;
    for (const section of sectionize(doc.text)) {
      const sentences = splitSentences(section.body);
      sentences.forEach((text, index) => {
        candidates.push({
          text,
          section: section.heading,
          docName: doc.name,
          score: scoreSentence(text, section.heading, index),
          order: order++,
          kind: classify(text),
        });
      });
    }
    candidates.sort((a, b) => b.score - a.score);
    const chosen: Sentence[] = [];
    for (const c of candidates) {
      if (c.score < 2) continue;
      const tokens = tokenSet(c.text);
      if (chosen.some((x) => overlap(tokens, tokenSet(x.text)) > 0.62)) continue;
      chosen.push(c);
      if (chosen.length >= perDoc) break;
    }
    chosen.sort((a, b) => a.order - b.order);
    picked.push(...chosen);
  }
  return picked;
}

function clipQuote(s: string, max = 180): string {
  if (s.length <= max) return s.replace(/\s+/g, " ").trim();
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return `${cut.slice(0, sp > 80 ? sp : max).trim()}…`;
}

function authorsVoice(s: string): string {
  return s
    .replace(/\b[Ww]e (found|show|demonstrate|argue|measure|report|propose)\b/g, "the authors $1")
    .replace(/\b[Oo]ur (results|findings|data|study|experiment)\b/g, "their $1")
    .replace(/\b[Tt]his (paper|study|article|work)\b/g, "the study")
    .replace(/\s+/g, " ")
    .trim();
}

function ask(s: Sentence, i: number): string {
  const hook = clipQuote(s.text, 90);
  const prompts: Record<Sentence["kind"], string[]> = {
    finding: [
      `Okay, headline time. They write: “${hook}” Is that the result we’re supposed to remember?`,
      `This is the part that would go on a conference slide. What did they actually find?`,
    ],
    method: [
      `Before we trust the claim, how did they even measure this?`,
      `Walk me through the setup. Who was in the room, and what got counted?`,
    ],
    number: [
      `That number is doing a lot of work. What’s behind it?`,
      `I don’t want a vibes summary. What’s the figure, and what does it compare against?`,
    ],
    limit: [
      `They’re hedging. What’s the catch if someone tries to use this on Monday?`,
      `If I’m a skeptic in the back row, where is this study thin?`,
    ],
    claim: [
      `Jordan, unpack this stretch of the document for me.`,
      `What is the authors’ actual claim in this section, in language a tired human can keep?`,
    ],
  };
  const list = prompts[s.kind];
  return list[i % list.length];
}

function answer(s: Sentence, i: number): { text: string; quote?: string } {
  const voiced = authorsVoice(s.text);
  const openers = [
    `Here’s what the text actually says.`,
    `Staying close to the page:`,
    `From the ${s.section.toLowerCase()} section:`,
    `They put it like this.`,
  ];
  const opener = openers[i % openers.length];
  const quote = clipQuote(s.text, 200);
  if (s.kind === "limit") {
    return {
      text: `${opener} They flag a real constraint: ${voiced} That’s the grain of salt, not a reason to throw the rest out.`,
      quote,
    };
  }
  if (s.kind === "method") {
    return {
      text: `${opener} ${voiced} So the claim is only as strong as that measurement.`,
      quote,
    };
  }
  return {
    text: `${opener} ${voiced}`,
    quote,
  };
}

function takeaways(sentences: Sentence[]): string[] {
  const ranked = [...sentences].sort((a, b) => {
    const rank = (k: Sentence["kind"]) =>
      k === "finding" ? 3 : k === "number" ? 2 : k === "limit" ? 1 : 0;
    return rank(b.kind) - rank(a.kind) || b.score - a.score;
  });
  const out: string[] = [];
  for (const s of ranked) {
    const t = authorsVoice(s.text);
    const short = t.length > 140 ? `${t.slice(0, t.lastIndexOf(" ", 140))}…` : t;
    if (out.some((x) => overlap(tokenSet(x), tokenSet(short)) > 0.5)) continue;
    out.push(short);
    if (out.length === 3) break;
  }
  return out;
}

function line(host: HostId, text: string, quote?: string): ScriptLine {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${host}-${Math.random().toString(36).slice(2)}`,
    host,
    text,
    quote,
  };
}

function minutesFromWords(words: number): number {
  return Math.max(45, Math.round((words / 155) * 60));
}

export function generatePodcast(docs: ExtractedDoc[]): PodcastScript {
  if (!docs.length) {
    throw new Error("Add at least one document before generating a show.");
  }

  const titles = docs.map(detectTitle);
  const episodeTitle =
    titles.length === 1 ? titles[0] : `${titles[0]}, and ${titles.length - 1} more`;
  const totalWords = docs.reduce((n, d) => n + d.wordCount, 0);
  const perDoc = docs.length === 1 ? 8 : Math.max(4, Math.round(10 / docs.length));
  const beats = pickSentences(docs, perDoc);
  if (beats.length < 2) {
    throw new Error(
      "There wasn’t enough extractable prose to write a show. Try a longer document with full sentences."
    );
  }

  const lines: ScriptLine[] = [];
  const fileList = docs
    .map((d) => d.name.replace(/\.[a-z0-9]+$/i, ""))
    .join(docs.length === 2 ? " and " : ", ");

  lines.push(
    line(
      "maya",
      `You're listening to PaperCast. Two people, one stack of documents, no cloud bill. On the desk today: ${fileList}.`
    )
  );

  if (docs.length === 1) {
    const d = docs[0];
    const pages = d.pages ? `${d.pages}-page ` : "";
    lines.push(
      line(
        "jordan",
        `I read the ${pages}${d.kind === "pdf" ? "PDF" : "file"} so you don’t have to. Roughly ${d.wordCount.toLocaleString()} words, titled “${titles[0]}.” I’ll stay close to the text; Maya will keep me honest.`
      )
    );
  } else {
    lines.push(
      line(
        "jordan",
        `We’ve got ${docs.length} files, about ${totalWords.toLocaleString()} words combined. I’ll take them in order and flag what the pages actually claim, not what we wish they claimed.`
      )
    );
  }

  lines.push(
    line(
      "maya",
      "Deal. If a sentence sounds like marketing, read it anyway. The whole point of a free paper to podcast is that we don’t outsource the reading."
    )
  );

  let lastDoc = "";
  beats.forEach((beat, i) => {
    if (beat.docName !== lastDoc && docs.length > 1) {
      lastDoc = beat.docName;
      lines.push(
        line(
          "maya",
          `New file. This next stretch is from ${beat.docName}.`
        )
      );
      lines.push(
        line(
          "jordan",
          `Opening that one now. I’ll pull the important sentences, not the bibliography.`
        )
      );
    }
    lines.push(line("maya", ask(beat, i)));
    const a = answer(beat, i);
    lines.push(line("jordan", a.text, a.quote));
    if (i === Math.floor(beats.length / 2)) {
      lines.push(
        line(
          "maya",
          "Hold on. If someone’s listening while they cook, what’s the one line version of what we just covered?"
        )
      );
      lines.push(
        line(
          "jordan",
          `One line: ${authorsVoice(beats[Math.max(0, i - 1)]?.text ?? beat.text)}`
        )
      );
    }
  });

  const bullets = takeaways(beats);
  lines.push(
    line("maya", "Let’s land the plane. Three things a listener should keep after this episode.")
  );
  bullets.forEach((item, idx) => {
    lines.push(line("jordan", `${idx + 1}. ${item}`));
  });
  lines.push(
    line(
      "maya",
      "That’s PaperCast. Drop another PDF or notes file when you’ve got one. We’ll make the next show in the browser, no API keys required."
    )
  );
  lines.push(
    line(
      "jordan",
      "And if the voices sound like your operating system, that’s because they are. Free on purpose. Thanks for listening."
    )
  );

  const wordCount = lines.reduce((n, l) => n + l.text.split(/\s+/).length, 0);
  const logline =
    docs.length === 1
      ? `Maya and Jordan walk through “${titles[0]}” using the document’s own claims.`
      : `A ${docs.length}-file episode spanning ${titles.slice(0, 2).join(" and ")}.`;

  return {
    showTitle: "PaperCast",
    episodeTitle,
    logline,
    sources: docs.map((d) => ({ name: d.name, words: d.wordCount, pages: d.pages })),
    takeaways: bullets,
    lines,
    wordCount,
    estimatedSeconds: minutesFromWords(wordCount),
  };
}
