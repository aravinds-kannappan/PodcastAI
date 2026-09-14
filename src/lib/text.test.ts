import { describe, expect, it } from "vitest";
import { sectionize, normalizeSectionHeading } from "./text";

const PAPER = `Abstract
This paper studies interruption frequency and afternoon recall.

Introduction
Knowledge work is noisy. Related work is cited only in passing.

Related work
Prior calendar studies treated quiet time as a wellness perk.

Methods
We recruited 84 knowledge workers on self-selected teams.

Experiments
Each team either kept a 90-minute quiet block or left Slack unconstrained.

Results
Quiet-hour teams recalled 31 percent more briefing items.

Discussion
The result is about memory, not document count.

Limitations
We did not randomize. Teams that can negotiate already differ.

Conclusion
Try the quiet hour before buying another focus app.

References
1. A made-up citation.
`;

describe("section detection", () => {
  it("splits academic headings into ordered sections with ids", () => {
    const sections = sectionize(PAPER);
    const headings = sections.map((s) => s.heading.toLowerCase());
    expect(headings).toEqual(
      expect.arrayContaining([
        "abstract",
        "introduction",
        "related work",
        "methods",
        "experiments",
        "results",
        "discussion",
        "limitations",
        "conclusion",
        "references",
      ])
    );
    expect(sections.every((s) => s.id && typeof s.order === "number")).toBe(true);
    expect(normalizeSectionHeading("METHODS")).toMatch(/method/i);
  });
});
