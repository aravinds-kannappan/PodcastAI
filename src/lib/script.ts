import { makeId } from "./text";
import type { EpisodePlan, PaperModel, PlanBeat, PodcastScript, ScriptLine } from "./types";

function line(
  host: ScriptLine["host"],
  text: string,
  extra?: Pick<ScriptLine, "quote" | "beatId" | "claimId">
): ScriptLine {
  return {
    id: makeId("line"),
    host,
    text,
    ...extra,
  };
}

function filesLine(model: PaperModel): string {
  const names = model.sourceNames.map((n) => n.replace(/\.[a-z0-9]+$/i, ""));
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]}, plus ${names.length - 1} other files`;
}

function claimOf(model: PaperModel, id?: string) {
  if (!id) return undefined;
  return model.claims.find((c) => c.id === id);
}

function renderBeat(beat: PlanBeat, model: PaperModel, engineNote: string): ScriptLine[] {
  const claim = claimOf(model, beat.claimId);
  const quote = beat.quote;
  const extra = { beatId: beat.id, claimId: claim?.id, quote };

  switch (beat.role) {
    case "cold-open":
      return [
        line(
          "maya",
          `You're listening to PaperCast. We don't read the file aloud. We extract it, build a PaperModel, plan the episode, then write this conversation. On the desk today: ${filesLine(model)}.`,
          { beatId: beat.id }
        ),
        line(
          "jordan",
          model.authorsLine
            ? `${model.authorsLine} left a paper trail. I'll stay with the modeled claims; Maya will keep me from turning a memo into a TED talk.`
            : `About ${model.wordCount.toLocaleString()} words of source. I'll stay with the modeled claims; Maya will keep me from turning a memo into a TED talk.`,
          { beatId: beat.id }
        ),
      ];
    case "setup":
      return [
        line("maya", "Give me the thesis in one breath. Not the abstract pasted back at me.", {
          beatId: beat.id,
        }),
        line("jordan", model.thesis, { beatId: beat.id }),
      ];
    case "bridge":
      return [
        line(
          "maya",
          "Hold on. If someone's listening while they cook, what's the one-line version of what we just covered?",
          { beatId: beat.id }
        ),
        line("jordan", `One line: ${model.thesis}`, { beatId: beat.id }),
      ];
    case "method":
      return [
        line("maya", "Before we treat that like a law of nature, how did they even measure it?", extra),
        line(
          "jordan",
          claim
            ? `${claim.text} So the headline is only as strong as that counting rule.`
            : "They do describe a setup, but the model didn't catch a clean method claim.",
          extra
        ),
      ];
    case "number":
      return [
        line("maya", "I don't want a vibes summary. What figure is doing the work?", extra),
        line(
          "jordan",
          claim
            ? `${claim.text}${claim.numbers.length ? ` Hold ${claim.numbers[0]} in your head.` : ""}`
            : "The model flagged a numeric stretch without a clean figure.",
          extra
        ),
      ];
    case "caveat":
      return [
        line("maya", "They're hedging. What's the catch if someone tries to use this on Monday?", extra),
        line(
          "jordan",
          claim
            ? `${claim.text} That's the grain of salt, not a reason to bin the rest.`
            : "The paper is more confident than it should be; the model didn't extract a clean limitation.",
          extra
        ),
      ];
    case "takeaway":
      return [
        line("maya", "Let's land the plane. Three things a listener should keep after this episode.", {
          beatId: beat.id,
        }),
        ...beat.talkingPoints.slice(0, 3).map((item, idx) =>
          line("jordan", `${idx + 1}. ${item}`, { beatId: beat.id })
        ),
      ];
    case "close":
      return [
        line(
          "maya",
          "That's PaperCast. Drop another PDF or notes file when you've got one. We'll model it in the browser.",
          { beatId: beat.id }
        ),
        line(
          "jordan",
          `${engineNote} If the voices sound like your operating system, that's because they are. Thanks for listening.`,
          { beatId: beat.id }
        ),
      ];
    default:
      return [
        line(
          "maya",
          claim?.kind === "recommendation"
            ? "What would a tired manager actually do with this on a Tuesday?"
            : "Jordan, unpack this claim in language a tired human can keep.",
          extra
        ),
        line(
          "jordan",
          claim
            ? `${claim.text}${claim.kind === "finding" ? " That's the result, not a mood." : ""}`
            : beat.talkingPoints[1] ?? beat.intent,
          extra
        ),
      ];
  }
}

function minutesFromWords(words: number): number {
  return Math.max(45, Math.round((words / 155) * 60));
}

export function writeScript(
  model: PaperModel,
  plan: EpisodePlan,
  engineNote = "This booth used the rule writer because Ollama was not running."
): PodcastScript {
  const lines = plan.beats.flatMap((beat) => renderBeat(beat, model, engineNote));
  const wordCount = lines.reduce((n, l) => n + l.text.split(/\s+/).filter(Boolean).length, 0);
  return {
    showTitle: "PaperCast",
    episodeTitle: plan.episodeTitle,
    logline: plan.logline,
    sources: model.sourceNames.map((name) => ({
      name,
      words: model.wordCount,
    })),
    takeaways: plan.takeaways,
    lines,
    wordCount,
    estimatedSeconds: minutesFromWords(wordCount),
  };
}
