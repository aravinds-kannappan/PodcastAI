#!/usr/bin/env node
/**
 * Writes a multi-page synthetic research PDF for the PaperCast demo.
 * Uses only the PDF built-in Times fonts. No extra packages.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TITLE =
  "Civic Attention Decay: Notification Density and Recall in Knowledge Work";

const BLOCKS = [
  { type: "kicker", text: "Working paper  --  14 March 2026  --  Not for journal submission" },
  { type: "title", text: TITLE },
  {
    type: "authors",
    text: "Elena Voss, Priya Raman, and Jonah Hale  --  Civic Systems Lab",
  },
  { type: "h", text: "Abstract" },
  {
    type: "p",
    text: "Knowledge workers now swim in notification density that would have looked like a paging storm a decade ago. We asked whether that density predicts what people can actually recall from documents they were supposed to have read. Across 312 remote employees in twelve firms, we found that each additional ten non-urgent notifications per hour during a reading block was associated with an 18 percent drop in delayed recall of the assigned paper. The effect held after we accounted for sleep, role seniority, and self-reported interest in the topic. A protected quiet hour cut notification density by 72 percent and recovered most of the lost recall. We argue that civic and workplace reading is failing less because people are lazy and more because the channel is too loud. Limitations include a convenience sample and a two-week window. Still, the practical claim is blunt: if you want people to remember a paper, stop tapping them while they read it.",
  },
  { type: "h", text: "1. Introduction" },
  {
    type: "p",
    text: "Organizations still assign papers. They still hold briefings. They still ask staff to come back next week having understood a 30-page PDF. Meanwhile the same staff keep Slack, mail, and calendar banners alive on the same screen. This paper treats that collision as a measurement problem rather than a sermon about willpower.",
  },
  {
    type: "p",
    text: "We use the phrase civic attention decay for a simple pattern: as interruptive cues rise, the share of a document that can be recalled a few hours later falls, even when people report that they finished the file. The civic part matters. City staff, newsroom reporters, and nonprofit analysts are often the people asked to read long public documents under the worst notification climates.",
  },
  {
    type: "p",
    text: "Prior work on task switching shows costs in the range of several hundred milliseconds per switch, which sounds small until it is multiplied by a hundred pings. Our contribution is not another lab task with colored shapes. We handed people real documents, counted real workplace notifications, and then quizzed them on claims that actually appeared in the text.",
  },
  { type: "h", text: "2. Methods" },
  {
    type: "p",
    text: "We recruited 312 knowledge workers through professional networks in public agencies, newsrooms, and software firms. Median age was 34. Fifty-four percent identified as women. Participants were not paid beyond a summary of their own team's results.",
  },
  {
    type: "p",
    text: "Each person received a 2,400-word briefing paper on congestion pricing, chosen because it is dense, civic, and unfamiliar to most private-sector staff. They had 40 minutes to read it on their ordinary work laptop. We did not block applications. We asked them to work as they normally would.",
  },
  {
    type: "p",
    text: "Notification density was measured from OS-level notification logs that participants exported themselves, plus Slack analytics where available. We counted banners, sounds, and badge bumps that occurred during the 40-minute reading window. We excluded notifications the participant had explicitly classified as urgent in a pre-survey, so a page from a child's school still counted as urgent and was removed from the density score.",
  },
  {
    type: "p",
    text: "Recall was a 16-item short-answer quiz administered four hours later. Items were drawn from the briefing: three numbers, five named mechanisms, four caveats, and four who-said-what attributions. Two raters scored answers against a rubric. Agreement was high (Cohen's kappa = 0.84).",
  },
  {
    type: "p",
    text: "In week two, six of the twelve firms ran a quiet hour: 90 minutes of calendar-busy time with Slack set to notifications-off except for a named emergency channel. The other six firms were waitlisted. Assignment was at the firm level, not the person level, which we treat as a limitation rather than a feature.",
  },
  { type: "h", text: "3. Results" },
  {
    type: "p",
    text: "Mean notification density during the reading block was 9.6 events per hour in week one (standard deviation 6.1). The distribution had a long right tail; a software support pod averaged 22 events per hour.",
  },
  {
    type: "p",
    text: "We found that delayed recall fell as density rose. In a linear model with controls for sleep duration, seniority, and topic interest, ten extra non-urgent notifications per hour predicted an 18 percent relative drop in quiz score (95 percent interval 12 to 24 percent). People in the top density quartile recalled 41 percent of items. People in the bottom quartile recalled 63 percent.",
  },
  {
    type: "p",
    text: "Numbers were hit hardest. Participants could still paraphrase the political argument after a noisy reading session, but they lost the figures: the $4.50 toll, the 14 percent traffic drop in the cited pilot, the three exemptions. That pattern is consistent with a story about interrupted encoding of specifics rather than a story about total disengagement.",
  },
  {
    type: "p",
    text: "The quiet hour cut measured density by 72 percent on average. Quiz scores in quiet-hour firms rose 11 points on a 100-point scale relative to their own week-one baseline, while waitlisted firms moved less than two points. We cannot call this a fully randomized field experiment, but the before-after contrast is hard to ignore.",
  },
  {
    type: "p",
    text: "Self-report lied in a familiar way. Eighty-one percent of high-density readers said they had read the paper carefully. Their quiz scores said otherwise. Managers who glanced at presence indicators would have concluded the work was done.",
  },
  { type: "h", text: "4. Discussion" },
  {
    type: "p",
    text: "The practical implication is unfashionable. Tool vendors sell summarizers and text-to-speech so that people can consume papers while remaining interruptible. That may help with exposure. It does not obviously help with recall of the parts of a document that are easy to lose: numbers, caveats, and who claimed what.",
  },
  {
    type: "p",
    text: "If an agency needs staff to remember a consultation paper, the cheaper intervention is calendar hygiene, not another listening app. A two-host podcast of a document can still be useful as a first pass. It should not be confused with encoding the source. We say that as researchers who also listen to papers while cooking.",
  },
  {
    type: "p",
    text: "Civic attention decay is not a metaphor about decadence. It is a measured relationship between channel noise and memory for public documents. Cities that email 40-page PDFs into a Slack culture should expect the quiz scores we saw.",
  },
  { type: "h", text: "5. Limitations" },
  {
    type: "p",
    text: "This sample is convenient, not civic in the strict sense: we have more software firms than planning departments. The reading task used one document. Two weeks is a short window. Firm-level assignment of the quiet hour means we cannot separate the policy from the kind of firm willing to try it. We did not observe what people did with the recovered minutes; some of them certainly opened another tab.",
  },
  {
    type: "p",
    text: "We also cannot see notifications that never hit the OS log, such as a colleague waving on a video call. Our density measure is a lower bound. If anything, the true association is steeper.",
  },
  { type: "h", text: "6. Conclusion" },
  {
    type: "p",
    text: "We conclude that notification density is a first-order predictor of whether a workplace paper is remembered. A quiet hour is a blunt, free intervention that recovered a large share of lost recall in this sample. If you are going to assign a document, assign the silence it needs.",
  },
  {
    type: "p",
    text: "Future work should test the same design on actual city staff reading zoning packets, and should ask whether audio walkthroughs of a paper help or merely create an illusion of coverage. Until then, the sentence we want repeated is this: interruption frequency predicts afternoon recall better than hours spent with the file open.",
  },
];

function wrap(text, width) {
  const words = text.split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? `${cur} ${w}` : w;
    if (trial.length > width) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = trial;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function esc(s) {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function renderPages() {
  const pages = [];
  let lines = [];
  const max = 46;

  function flush() {
    if (!lines.length) return;
    pages.push(lines);
    lines = [];
  }

  function add(line) {
    if (lines.length >= max) flush();
    lines.push(line);
  }

  for (const block of BLOCKS) {
    if (block.type === "kicker") {
      add({ font: "F2", size: 9, text: block.text, gap: 10 });
    } else if (block.type === "title") {
      for (const t of wrap(block.text, 42)) {
        add({ font: "F3", size: 16, text: t, gap: 18 });
      }
      add({ font: "F1", size: 11, text: " ", gap: 8 });
    } else if (block.type === "authors") {
      add({ font: "F2", size: 10, text: block.text, gap: 14 });
      add({ font: "F1", size: 11, text: " ", gap: 10 });
    } else if (block.type === "h") {
      add({ font: "F1", size: 11, text: " ", gap: 12 });
      add({ font: "F3", size: 13, text: block.text, gap: 16 });
    } else {
      for (const t of wrap(block.text, 92)) {
        add({ font: "F1", size: 11, text: t, gap: 13 });
      }
      add({ font: "F1", size: 11, text: " ", gap: 8 });
    }
  }
  flush();
  return pages;
}

function pageStream(pageLines) {
  const ops = ["BT", "72 720 Td"];
  let lastFont = "";
  let lastSize = 0;
  for (const line of pageLines) {
    const key = `${line.font}:${line.size}`;
    if (key !== `${lastFont}:${lastSize}`) {
      ops.push(`/${line.font} ${line.size} Tf`);
      lastFont = line.font;
      lastSize = line.size;
    }
    ops.push(`(${esc(line.text)}) Tj`);
    ops.push(`0 -${line.gap} Td`);
  }
  ops.push("ET");
  return ops.join("\n");
}

function buildPdf() {
  const pages = renderPages();
  const nPages = pages.length;
  const catalogId = 1;
  const pagesId = 2;
  const font1 = 3;
  const font2 = 4;
  const font3 = 5;
  const firstContent = 6;
  const firstPage = firstContent + nPages;

  const contents = pages.map((p) => pageStream(p));
  const pageIds = contents.map((_, i) => firstPage + i);

  const objs = [];
  objs[catalogId] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objs[pagesId] = `<< /Type /Pages /Kids [${pageIds
    .map((id) => `${id} 0 R`)
    .join(" ")}] /Count ${nPages} >>`;
  objs[font1] = "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>";
  objs[font2] = "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic >>";
  objs[font3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>";
  contents.forEach((stream, i) => {
    objs[firstContent + i] = `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`;
  });
  pageIds.forEach((id, i) => {
    objs[id] = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R /F3 ${font3} 0 R >> >> /Contents ${
      firstContent + i
    } 0 R >>`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 1; i < objs.length; i++) {
    offsets[i] = Buffer.byteLength(pdf);
    pdf += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objs.length}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < objs.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objs.length} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return pdf;
}

const out = path.join(__dirname, "..", "public", "samples", "CivicAttention.pdf");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, buildPdf());
console.log("wrote", out, fs.statSync(out).size, "bytes");
