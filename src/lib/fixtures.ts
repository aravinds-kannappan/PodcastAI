import type { ExtractedDoc } from "./types";

export const QUIET_HOUR_TEXT = `MEMO

To: People Ops and the tools guild
From: Nia Okonkwo, workplace research
Date: 12 March 2026
Subject: The quiet hour effect: interruption frequency and working memory

We measured calendar noise for six remote teams over four weeks. The question was simple: does a protected 90-minute quiet hour change how much people remember from a morning briefing?

We found that teams with a daily 9:30–11:00 quiet block recalled 31 percent more of the briefing items at 4 p.m. than teams that left Slack and meetings unconstrained. The comparison group averaged 11.4 inbound pings per hour during that window. The quiet-hour group averaged 2.1, mostly from exceptions the team had already agreed on.

This is not a productivity miracle. People did not write more documents. They made fewer "wait, what was the decision?" follow-ups. Managers reported that standups shrank by about four minutes because fewer items had to be restated.

How we counted: 84 knowledge workers, self-selected teams, ping counts from exportable Slack analytics plus calendar event density. Recall was a 12-item quiz on the morning briefing, scored blind.

Limitations are obvious. Teams that adopt a quiet hour are already the ones that can negotiate with their stakeholders. We did not randomize. Two teams cheated and kept "just this one huddle." We still included them.

Recommendation: try the quiet hour for two weeks on one team before you buy another focus app. Put the rule in the calendar as busy, not as a Slack status. Statuses get ignored. Busy blocks get fewer invites.

If we keep one sentence from this memo, it should be this: interruption frequency predicts afternoon recall better than hours worked.
`;

export function quietHourDoc(): ExtractedDoc {
  const text = QUIET_HOUR_TEXT;
  return {
    id: "quiet-hour",
    name: "QuietHourMemo.txt",
    kind: "text",
    text,
    wordCount: text.trim().split(/\s+/).length,
  };
}
