# Iteration 4 — Elevation Plan v1 (pre-review draft) — Loop 2 begins

## Where the design stands after loop 1 (iters 1-3)

Landing, dashboard (MomentumRing), appointments, auth, and the FitBot
message *shell* (avatars, bubbles, Baloo header) are all elevated. What's
still visibly unfinished, found by inspecting the current code:

1. **FitBot returns structured data as PLAIN TEXT.** `chat-experience.tsx`
   and `chatbot-overlay.tsx` render every reply as `{message.content}` in a
   `<p>`. A schedule query comes back as a run-on bubble ("Here's the
   matching schedule: Morning HIIT (HIIT) with Avery Thompson — Thu, Aug 20,
   7:00 AM — 13/16 spots. Midday Flow (Yoga)..."). Member lookups, workout
   plans, outreach drafts — all flat text. This directly contradicts the
   original overhaul brief: "schedule results should appear as class cards,
   member searches as member cards, workout plans as organized exercise
   blocks." **This is the single biggest remaining gap and the highest-value
   elevation left in the product.**

2. **`/staff` is still a bare "verification fixture" placeholder.** It's an
   empty-state card that says "Real staff features land in a later phase."
   Meanwhile the actual staff tools (member lookup, retention, time-off,
   schedule ops) exist only as FitBot intents with no visual home. A staff
   member landing here sees a dead end.

3. **Confirmation/mutation states are minimal** — booking confirm, and the
   staff outreach "send" confirmation gate (a product-critical explicit
   step) render without much design weight.

## LOCKED requirement (user directive, mid-iteration — not optional)

**Human instructor profile photos on the appointment cards.** Every class
card (on `/appointments` AND in the new in-chat schedule cards) shows a real
human portrait of the person running the session, next to "with {instructor}".
- Sourcing: licensing-safe royalty-free portraits bundled LOCALLY in
  `public/instructors/` (no runtime external image dependency), mapped by
  instructor name. Fallback to a clean initials avatar for any instructor
  without a mapped photo.
- A11y: meaningful `alt` (e.g. "Sofia Martinez, instructor"); photos are
  decorative-adjacent but naming the instructor is useful.
- Presentation: reviewers weigh size/placement/shape (circle vs rounded),
  but the photo must not crowd the class info or hurt the type hierarchy.

## Iteration 4 scope (draft — reviewers will stress-test)

**Primary: rich in-chat result cards (done ADDITIVELY, non-breaking).**
- The intent handlers currently return `{ reply: string }`. Extend them to
  ALSO return an optional structured payload, e.g.
  `{ reply, card?: { kind: 'schedule'|'members'|'workout'|'outreach', ... } }`.
  The `reply` string STAYS as a guaranteed fallback so the deterministic
  router contract built/reviewed in Phases 4-10 is not broken — a client
  that ignores `card` still works exactly as today.
- Chat renders a typed rich component when `card` is present (schedule →
  class-card list reusing the appointments card language; members → member
  cards; workout → exercise blocks; outreach → a draft card with the
  explicit send-confirmation treatment), else falls back to the text bubble.
- Same rich rendering in BOTH the full `/chat` page and the FitBot overlay
  (shared components).

**Secondary: turn `/staff` into a real staff console.**
- Replace the placeholder with a designed operational landing: an eyebrow +
  Baloo hero, then a grid of staff-tool cards (Member lookup, Retention
  outreach, Time off, Schedule ops) that each open FitBot pre-seeded with
  the relevant prompt (or deep-link where a real screen exists). Uses the
  existing module-card / surface-card system so it belongs to the suite.

**Tertiary (only if it fits without bloating the handoff): confirmation
polish** — booking-confirm and outreach-send confirmation states get proper
design-system treatment (clear primary/secondary action separation, the
"nothing has been sent yet" reassurance made visually explicit).

## Known risk to flag for reviewers

The rich-card change is the one item that touches beyond pure CSS — it
extends the intent-handler return shape and the chat render path. It's
designed to be ADDITIVE (reply string preserved, `card` optional) so it
can't break the router. Reviewers should weigh: is this worth doing in a
"UI/UX elevation" loop, or does it overstep into architecture that should
be its own task? If they say overstep, v2 scopes the rich rendering to a
presentation-only approach (e.g. the handlers already have the structured
data internally — expose it without changing router semantics) or defers it.

## Open questions for the adversarial reviewers

- Rich cards in a narrow chat column (overlay is ~380px): do class/member
  cards actually read at that width, or become cramped? What's the right
  density?
- Does turning `/staff` into a launcher-of-FitBot-prompts feel real, or
  like a fake menu that just punts everything to chat?
- Where's the highest-leverage single change this iteration?
- Anything about the additive-card approach that risks the router contract
  or the a11y/live-region behavior of the message list?
