# Iteration 8 — Elevation Plan v1 (pre-review)

## The gap

Iteration 4 gave 4 intents rich cards (schedule, member-lookup, workout-plan,
outreach-draft). Checked all 10 intents — **5 still return plain text only**:
`who-is-booked`, `my-appointments`, `retention-lookup`, `time-off`,
`outreach-send`. This is a visible inconsistency: a user has no way to
predict whether their question gets a polished card or a text wall, and
`my-appointments` ("what appointments do I have") is one of the most common
CLIENT queries in the whole product — currently a run-on text bubble.

## Scope (additive, same contract discipline as iter 4)

**High-confidence reuse (do first):**
- `my-appointments`: queries the identical `classes` columns as
  `schedule.ts`. Emit the EXISTING `schedule` RichCard kind — zero new
  design, proven component.
- `who-is-booked`: same columns. When it resolves multiple candidate
  classes ("I found a few possible classes"), emit a `schedule` card for
  that list too. For the single-matched-class case (today: one line of
  text with booked/capacity), consider whether the schedule card's
  single-row rendering is worth using here or if text remains fine for one
  result (reviewers weigh — a card for ONE row might be overkill).

**Needs a small new mapping, still reusing an existing card kind:**
- `retention-lookup`: staff-facing, surfaces members needing re-engagement.
  Reuse the existing `members` RichCard kind (name/email/status) — status
  text becomes the re-engagement reason (e.g. "last booked 34 days ago"),
  reusing member-lookup's exact card shape.

**Open design question (reviewers weigh):**
- `time-off`: staff requests time off; currently text confirmation. Is a
  card warranted, or does a request-confirmation read better as text +
  the (already-built, iter-7) toast pattern? Don't invent a 5th card kind
  without reviewer sign-off — might not be worth the surface area for a
  single confirmation message.
- `outreach-send`: mirrors `outreach-draft`'s data. Could reuse/extend the
  `outreach` card kind with `sent: true` (the type currently hardcodes
  `sent: false` — that's a real typing gap for this exact case). Natural
  fit given iter-7 already built the outreach card and its toast.

## Guardrails (carried forward, non-negotiable)
- Contract-additive only: `reply` stays full and self-sufficient for every
  handler touched; no query/matcher/router changes; existing behavior
  unchanged for any handler NOT explicitly listed here.
- Cards render outside `aria-live` regions (established iter-4 split).
- No new card KIND without clear justification — prefer reusing
  `schedule`/`members`/`outreach` where the data genuinely fits, per above.
- No new npm dependencies.

## Open questions for reviewers
- Is a card justified for EVERY one of these 5, or does plain text remain
  correct for some (e.g. a single-row who-is-booked result, or time-off's
  confirmation)? Don't force cards where text is honestly better.
- `outreach-send` reusing the outreach card with `sent: true` — right
  call, or does a "sent" state need distinct visual treatment (vs. a
  draft)?
- Highest-leverage single element in this batch.
