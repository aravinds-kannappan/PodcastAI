import { clipQuote, makeId } from "./text";
import type { BeatRole, EpisodePlan, ModelClaim, PaperModel, PlanBeat } from "./types";

function intentFor(claim: ModelClaim): string {
  switch (claim.kind) {
    case "finding":
      return "Put the headline result in working memory, with the comparison attached.";
    case "method":
      return "Show how the number was produced before anyone treats it as a law of nature.";
    case "number":
      return "Anchor the episode on a specific figure, not a vibe.";
    case "limit":
      return "Name the grain of salt so the listener can use the result on Monday.";
    case "recommendation":
      return "Translate the paper into one action that does not require a new vendor.";
    default:
      return "Give just enough context so the claims have a place to sit.";
  }
}

function talkingPoints(claim: ModelClaim): string[] {
  const num = claim.numbers.slice(0, 2).join(" and ");
  switch (claim.kind) {
    case "finding":
      return [
        `Ask whether the result is a headline or a rounding error.`,
        claim.text,
        num ? `Keep ${num} in the answer, not as decoration.` : "Stay with the comparison, not the adjectives.",
      ];
    case "method":
      return [
        `Demand the setup before trusting the claim.`,
        claim.text,
        "If the measurement is soft, say so.",
      ];
    case "limit":
      return [
        `Invite a skeptic. Where is this thin?`,
        claim.text,
        "Do not throw the finding out; bound it.",
      ];
    case "recommendation":
      return [
        `What would a tired manager actually do?`,
        claim.text,
      ];
    default:
      return [
        `Unpack this stretch without reading it aloud.`,
        claim.text,
      ];
  }
}

function roleFor(claim: ModelClaim): BeatRole {
  if (claim.kind === "method") return "method";
  if (claim.kind === "limit") return "caveat";
  if (claim.kind === "number") return "number";
  return "claim";
}

export function planEpisode(model: PaperModel): EpisodePlan {
  const findings = model.claims.filter((c) => c.kind === "finding" || c.kind === "number");
  const methods = model.claims.filter((c) => c.kind === "method");
  const limits = model.claims.filter((c) => c.kind === "limit");
  const recs = model.claims.filter((c) => c.kind === "recommendation");
  const rest = model.claims.filter(
    (c) => !findings.includes(c) && !methods.includes(c) && !limits.includes(c) && !recs.includes(c)
  );

  const bodyClaims: ModelClaim[] = [
    ...findings.slice(0, 4),
    ...methods.slice(0, 2),
    ...rest.slice(0, 1),
    ...limits.slice(0, 2),
    ...recs.slice(0, 1),
  ];
  const seen = new Set<string>();
  const ordered: ModelClaim[] = [];
  for (const c of bodyClaims) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    ordered.push(c);
  }
  if (ordered.length < 2) {
    for (const c of model.claims) {
      if (seen.has(c.id)) continue;
      ordered.push(c);
      if (ordered.length >= 3) break;
    }
  }

  const beats: PlanBeat[] = [];
  beats.push({
    id: makeId("beat"),
    role: "cold-open",
    intent: "Establish that this is a modeled episode, not a PDF read-aloud.",
    talkingPoints: [
      "Name the show and the document.",
      "Say we built a paper model first.",
    ],
  });
  beats.push({
    id: makeId("beat"),
    role: "setup",
    intent: "State the thesis in one breath.",
    talkingPoints: [model.thesis, model.authorsLine ?? model.sourceNames.join(", ")],
  });

  ordered.forEach((claim, i) => {
    if (i === Math.floor(ordered.length / 2) && ordered.length >= 4) {
      beats.push({
        id: makeId("beat"),
        role: "bridge",
        intent: "Give a one-line recap for anyone cooking.",
        talkingPoints: [model.thesis],
      });
    }
    beats.push({
      id: makeId("beat"),
      role: roleFor(claim),
      intent: intentFor(claim),
      claimId: claim.id,
      talkingPoints: talkingPoints(claim),
      quote: clipQuote(claim.evidence, 200),
    });
  });

  const takeaways = ordered
    .filter((c) => c.kind === "finding" || c.kind === "limit" || c.kind === "recommendation")
    .slice(0, 3)
    .map((c) => c.text);
  while (takeaways.length < Math.min(3, ordered.length)) {
    const extra = ordered.find((c) => !takeaways.includes(c.text));
    if (!extra) break;
    takeaways.push(extra.text);
  }

  beats.push({
    id: makeId("beat"),
    role: "takeaway",
    intent: "Land three keepers without rereading the source.",
    talkingPoints: takeaways,
  });
  beats.push({
    id: makeId("beat"),
    role: "close",
    intent: "End the booth; remind the listener this was local.",
    talkingPoints: ["No cloud API.", "Voices are the browser."],
  });

  const logline = `Maya and Jordan walk a PaperModel of “${model.title}” — claims, methods, and caveats — then write the show from that plan.`;

  return {
    episodeTitle: model.title,
    logline,
    beats,
    takeaways,
  };
}
