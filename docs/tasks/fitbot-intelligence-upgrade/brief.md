# Brief: fitbot-intelligence-upgrade

## Scope (in the user's own words)

"Investigate the chatbot as it exists today and come up with a plan to make
it significantly smarter, and increase its function, responses, and message
recognition. If it can't figure out what the person wants it should present
them with the best options it has in the form of suggestions. I want
basically everything it outputs as a polished interface like they exist now
rather than raw text. Also it should have a brief loading animation when it
gets asked a question, maybe animate the circle to the left of the bots
responses to spin in place while it 'Thinks' — the idea is to make it seem
like its doing extensive thinking without slowing down the user experience
too much."

Broken into four work streams:

1. **Function/capability growth** — more things Fitbot can actually do.
2. **Message recognition** — better natural-language coverage (this repo
   just finished a confidence-scoring rework in `fitbot-capability-expansion`
   Phase 6 — this task should build on that, not replace it, unless
   investigation finds a reason to reconsider the approach).
3. **Graceful fallback as suggestions, not dead ends** — when routing
   confidence is low/zero, don't just return generic fallback text; surface
   the best-guess options as clickable suggestions (likely reusing the
   existing chip/RichCard mechanism).
4. **Polished output everywhere** — audit every intent's reply for plain
   prose-only responses that should have a RichCard instead, so close to
   nothing renders as bare text.
5. **"Thinking" loading state** — a lightweight animation on the bot avatar
   (the `MomentumArc` icon rendered to the left of assistant messages) that
   plays while a request is in flight, perceived-effort without added
   latency.

## Scope revision (post-plan-v1 discussion with the user)

The user reviewed `plan.md`'s Decision 1 (padded to 8 new intents) and pushed
back hard: most of the 8 were "bloat" — DB-column-driven, not user-need-driven.
After discussion, the capability-growth workstream is replaced with:

1. **Real attendee names** — fix `who-is-booked`'s current hard limitation
   (it can only report a booked-count, explicitly cannot name attendees:
   "Member names aren't available in the current staff view yet",
   `who-is-booked.ts:39`). A staff member asking "who's in the 6pm class" is
   a completely natural question this bot cannot currently answer at all.
2. **"What should I book?" class recommendation** — a client's
   goals/fitness_level/preferred_class_types are already on file but never
   used to generate an actual suggestion; today a client must already know
   what they want and ask for it by name.
3. **"What's happening right now / what's next"** — answer without
   requiring a date, the single most common front-desk-style question.

`member-profile-lookup`, `membership-status-lookup`, `member-contact-lookup`,
`birthday-lookup`, `staff-notes-flag`, `renewal-risk-lookup`,
`class-duration-search` are **dropped** — explicitly rejected as low-value
padding, not to be revisited without a new concrete user need.

Beyond that, the user asked for something "foundationally smarter," not just
more intents — the real centerpiece of this task is now:

4. **Conversation memory** — Fitbot currently has zero cross-message state;
   every message is scored/routed in total isolation (confirmed in
   `investigation.md`: `routeMessage` takes only `(message, session)`, no
   history). Needs: tracking recently-discussed entities (a class, a member,
   a date) so pronouns/shorthand ("that one," "the other class," "her too")
   resolve correctly across turns.
5. **Real slot-filling** — when an intent is missing a required entity
   (which class, which member), ask a specific clarifying question and
   actually consume the next message as the answer to complete the original
   request — not just a disambiguation list that requires restating the
   whole request. This changes/supersedes plan-v1's Decision 3
   (fallback-as-suggestions) — the planner should reconcile: does
   slot-filling replace the near-miss-suggestion mechanism, complement it,
   or are they for different situations (slot-filling for "intent matched,
   entity missing"; suggestions for "no intent matched at all")?
6. **Typo/fuzzy tolerance** — lightweight fuzzy matching (not ML — edit
   distance or similar deterministic algorithm) for names/class
   types/weekdays, so common misspellings don't silently fail to match.

Plan-v1's other decisions (Decision 2 scoring normalization, Decision 4
universal card polish + persistence fix, Decision 5 thinking animation)
remain in scope, folded into the same unified plan alongside the above.

## Explicitly out of scope for this task

- Adding a real LLM/AI backend — the existing constraint from
  `fitbot-capability-expansion` ("pass for AI completely through
  deterministic code") still applies unless the user says otherwise.
- Role model changes — client/staff/admin gating is done and correct.
- Anything already delivered in `fitbot-capability-expansion` (see that
  task's `final-report.md`) unless investigation finds it directly blocks
  this task's goals.

## Preflight state

- Repo: `C:\Users\Wil\Documents\Codex\fitbot`, branch `main`, all of
  `fitbot-capability-expansion`'s 7 phases pushed and live (commits up to
  `65dcab5`).
- Chatbot architecture: `lib/chatbot/router.ts` (confidence-scoring router),
  `lib/chatbot/intents/*.ts` (19 intents), `lib/chatbot/chips.ts` +
  `lib/chatbot/chip-labels.ts` (chip registry, role-gated), `lib/chatbot/
  types.ts` (7 `RichCard` kinds), `app/chat/chat-experience.tsx` +
  `app/components/chatbot-overlay.tsx` (the two client surfaces), `app/
  components/chat-cards.tsx` (card rendering), `app/components/icons.tsx`
  (`MomentumArc` — the bot avatar icon referenced in the request).

## Acceptance criteria for this GUIDE/COORDINATE pass

- Argus produces `investigation.md`: a real map of current intent coverage,
  every reply path that returns plain text with no card, the exact
  fallback-reply code path, and the `MomentumArc` icon's current
  markup/animation capability.
- Athena produces `plan.md`: concrete, numbered decisions per the standard
  format, a phased implementation plan, and explicit acceptance criteria —
  no implementation begins from this task until the user approves.
