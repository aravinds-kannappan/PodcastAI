import { clipQuote, makeId } from "./text";
import type {
  BeatPurpose,
  BeatRole,
  EpisodeOptions,
  EpisodePlan,
  ModelClaim,
  PaperModel,
  PlanBeat,
} from "./types";
import { DEFAULT_EPISODE_OPTIONS } from "./types";

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

function purposeForRole(role: BeatRole): BeatPurpose {
  switch (role) {
    case "cold-open":
      return "hook";
    case "setup":
      return "thesis";
    case "method":
      return "method";
    case "number":
      return "evidence";
    case "caveat":
      return "limitation";
    case "bridge":
      return "recap";
    case "takeaway":
      return "implication";
    case "close":
      return "recap";
    default:
      return "finding";
  }
}

function toneFor(role: BeatRole, style: EpisodeOptions["style"]): PlanBeat["tone"] {
  if (style === "reviewer") return "skeptical";
  if (role === "caveat") return "careful";
  if (role === "cold-open") return "curious";
  if (role === "takeaway") return "serious";
  if (style === "deep-dive") return "careful";
  return "curious";
}

function listenerQuestion(role: BeatRole, claim?: ModelClaim): string {
  if (role === "method") return "How did they actually measure that?";
  if (role === "caveat") return "What's the catch if someone uses this on Monday?";
  if (role === "number") return "Which figure is doing the work?";
  if (claim?.kind === "recommendation") return "What would a tired manager actually do?";
  if (role === "setup") return "What's the thesis in one breath?";
  return "What should a listener keep from this stretch?";
}

function beatTitle(role: BeatRole, claim?: ModelClaim): string {
  if (role === "cold-open") return "Hook";
  if (role === "setup") return "Thesis";
  if (role === "bridge") return "Recap";
  if (role === "takeaway") return "Takeaways";
  if (role === "close") return "Close";
  if (claim?.kind === "method") return "Method";
  if (claim?.kind === "limit") return "Limitation";
  if (claim?.kind === "number") return "Evidence";
  if (claim?.kind === "recommendation") return "Implication";
  return "Finding";
}

function makeBeat(
  role: BeatRole,
  intent: string,
  talking: string[],
  extra: {
    style: EpisodeOptions["style"];
    claim?: ModelClaim;
    quote?: string;
  }
): PlanBeat {
  const claimIds = extra.claim ? [extra.claim.id] : [];
  return {
    id: makeId("beat"),
    role,
    purpose: purposeForRole(role),
    title: beatTitle(role, extra.claim),
    goal: intent,
    intent,
    claimId: extra.claim?.id,
    claimIds,
    evidenceIds: extra.claim ? [`ev-${extra.claim.id}`] : [],
    listenerQuestion: listenerQuestion(role, extra.claim),
    tone: toneFor(role, extra.style),
    talkingPoints: talking,
    quote: extra.quote,
  };
}

function budgetFor(length: EpisodeOptions["length"]) {
  if (length === "short") {
    return { findings: 2, methods: 1, rest: 0, limits: 1, recs: 1, bridge: false };
  }
  if (length === "long") {
    return { findings: 5, methods: 3, rest: 2, limits: 2, recs: 2, bridge: true };
  }
  return { findings: 4, methods: 2, rest: 1, limits: 2, recs: 1, bridge: true };
}

function durationFor(length: EpisodeOptions["length"]): number {
  return length === "short" ? 6 : length === "long" ? 18 : 12;
}

export function planEpisode(
  model: PaperModel,
  options: EpisodeOptions = DEFAULT_EPISODE_OPTIONS
): EpisodePlan {
  const findings = model.claims.filter((c) => c.kind === "finding" || c.kind === "number");
  const methods = model.claims.filter((c) => c.kind === "method");
  const limits = model.claims.filter((c) => c.kind === "limit");
  const recs = model.claims.filter((c) => c.kind === "recommendation");
  const rest = model.claims.filter(
    (c) => !findings.includes(c) && !methods.includes(c) && !limits.includes(c) && !recs.includes(c)
  );

  const budget = budgetFor(options.length);
  const bodyClaims: ModelClaim[] = [
    ...findings.slice(0, budget.findings),
    ...methods.slice(0, budget.methods),
    ...rest.slice(0, budget.rest),
    ...limits.slice(0, budget.limits),
    ...recs.slice(0, budget.recs),
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
  beats.push(
    makeBeat(
      "cold-open",
      "Establish that this is a modeled episode, not a PDF read-aloud.",
      ["Name the show and the document.", "Say we built a paper model first."],
      { style: options.style }
    )
  );
  beats.push(
    makeBeat("setup", "State the thesis in one breath.", [model.thesis, model.authorsLine ?? model.sourceNames.join(", ")], {
      style: options.style,
    })
  );

  if (options.style === "deep-dive" || options.style === "reviewer") {
    beats.push(
      makeBeat(
        "setup",
        "Give just enough context so the claims have a place to sit.",
        model.background.slice(0, 2).length
          ? model.background.slice(0, 2)
          : ["Sketch the setting without reading the introduction aloud."],
        { style: options.style }
      )
    );
    beats[beats.length - 1] = {
      ...beats[beats.length - 1],
      purpose: "context",
      title: "Context",
      role: "setup",
    };
  }

  ordered.forEach((claim, i) => {
    if (budget.bridge && i === Math.floor(ordered.length / 2) && ordered.length >= 4) {
      beats.push(
        makeBeat("bridge", "Give a one-line recap for anyone cooking.", [model.thesis], {
          style: options.style,
        })
      );
    }
    beats.push(
      makeBeat(roleFor(claim), intentFor(claim), talkingPoints(claim), {
        style: options.style,
        claim,
        quote: clipQuote(claim.evidence, 200),
      })
    );
  });

  if (options.style === "reviewer" && limits[0] && !beats.some((b) => b.purpose === "skepticism")) {
    const limit = limits[0];
    const beat = makeBeat(
      "caveat",
      "Press on what the paper does not prove.",
      [limit.text, model.skepticalQuestions[0] ?? "Name what a reviewer would still demand."],
      { style: options.style, claim: limit, quote: clipQuote(limit.evidence, 200) }
    );
    beat.purpose = "skepticism";
    beat.title = "Skepticism";
    beat.tone = "skeptical";
    beats.push(beat);
  }

  const takeaways = ordered
    .filter((c) => c.kind === "finding" || c.kind === "limit" || c.kind === "recommendation")
    .slice(0, 3)
    .map((c) => c.text);
  while (takeaways.length < Math.min(3, ordered.length)) {
    const extra = ordered.find((c) => !takeaways.includes(c.text));
    if (!extra) break;
    takeaways.push(extra.text);
  }

  beats.push(
    makeBeat("takeaway", "Land three keepers without rereading the source.", takeaways, {
      style: options.style,
    })
  );
  beats.push(
    makeBeat("close", "End the booth; remind the listener this was local.", ["No cloud API.", "Voices are the browser."], {
      style: options.style,
    })
  );

  const logline = `Maya and Jordan walk a PaperModel of “${model.title}” — claims, methods, and caveats — then write the show from that plan.`;

  return {
    title: model.title,
    episodeTitle: model.title,
    logline,
    style: options.style,
    targetDurationMinutes: durationFor(options.length),
    beats,
    takeaways,
  };
}
