# Brief: Fitbot deterministic upgrade (workout depth, dataset access, guided quick-replies, rich cards)

## Scope

Significantly expand Fitbot's deterministic capability — not an LLM
integration (that's still deliberately deferred per
`docs/tasks/gitfit-suite-buildout/brief.md` Phase 11). Four requirements
from the user, verbatim intent preserved:

1. **Much more extensive deterministic code.** The current intent set
   (`lib/chatbot/intents/*`, ~11 intents) and especially
   `workout-plan.ts`'s exercise library are thin. Expand real, rule-based
   logic — not a bigger fallback string.
2. **Use the dataset intelligently.** Fitbot should be able to draw on
   the now-real `members`, `classes`, `bookings` data (landed in the
   shared-member-data task) in its answers — not just the narrow queries
   the existing intents already do.
3. **Access other pages' functions.** Wire Fitbot into functionality that
   today only exists on `/appointments`, `/staff`, `/dashboard` — the
   user wants the bot to be able to do more of what those pages can do,
   not just talk about them.
4. **Workout generator depth.** Today's `workoutPlanIntent`
   (`lib/chatbot/intents/workout-plan.ts`) has a small, fixed exercise
   library — the same handful of exercises recombine into every plan. The
   user likes the *output format* but wants **dozens of distinct workout
   templates**, not just recombined pieces from a tiny pool.
5. **Guided conversation tree with quick-reply chips.** Beyond free-text
   keyword matching, add a click-path: quick-suggestion buttons the user
   can click instead of typing, where **every quick suggestion has a
   guaranteed, premade answer** (deterministic — no ambiguity, no
   fallback). These premade answers render as rich cards, matching the
   existing visual style (see requirement 6).
6. **Consistent rich-card output.** Everything Fitbot returns — not just
   workouts — should render in a structured card format similar to the
   existing workout-plan card (`app/components/chat-cards.tsx`), not
   plain paragraph text.

## Out of scope

- No LLM integration — this is Phase 11 in the suite buildout brief and
  stays deferred.
- No change to the underlying `members`/`classes`/`bookings` schema —
  this task reads/uses existing data, doesn't add new tables.
- No change to `/appointments`, `/staff`, `/dashboard` pages themselves —
  Fitbot gains the ability to *call* their underlying functionality
  (booking, schedule queries, member lookup, etc.), not duplicate their UI.

## Process for this task

Per this project's standard workflow for a Feature: **Argus (investigate)
→ Athena (plan, with explicit decisions) → user approval → Codex
(implement) → Themis (review) → Apollo (verify)**. User explicitly asked
for Argus investigation and an Athena plan before implementation — this
brief exists to scope that investigation, not to hand off to Codex yet.

## Acceptance criteria (draft — Athena's plan should sharpen these)

1. The workout generator can produce meaningfully distinct plans across
   at least "dozens" of realistic goal/equipment/level/duration
   combinations, not recombinations of the same ~4-6 exercises per
   category.
2. At least several new deterministic intents exist that read from the
   real `members`/`bookings`/`classes` data in a way today's intents
   don't (e.g. a client asking about their own booking history/goals,
   staff asking data-driven questions the current intents can't answer).
3. At least one new intent lets Fitbot perform (not just describe) an
   action that today requires visiting another page — scoped precisely
   by Athena's plan.
4. A quick-reply chip system exists where every chip's answer is
   deterministic and pre-defined — clicking a chip never falls through
   to the generic fallback reply.
5. New response types render as structured cards via
   `app/components/chat-cards.tsx` (or an extension of it), matching the
   existing workout-card visual language, not raw paragraph text.
6. Existing intents/behavior (schedule, booking, time-off, retention,
   outreach, member lookup) keep working unchanged.

## Preflight state

- Branch: `main`, working tree clean as of the last two commits
  (`f81cc2c` shared member data, `1eb046e` appointments redesign).
- Relevant existing code: `lib/chatbot/router.ts` (keyword-match-in-order
  router), `lib/chatbot/intents/*` (11 files), `lib/chatbot/types.ts`,
  `app/components/chat-cards.tsx` (card renderer), `app/chat/chat-experience.tsx`
  + `app/components/chatbot-overlay.tsx` (two chat UIs, both call
  `/api/chat`), `lib/members/queries.ts` (new shared access layer from
  the prior task).
