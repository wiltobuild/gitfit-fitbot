# Iteration 4 — Elevation Plan v2 (post-review, reconciled)

## Theme: instructor faces + rich in-chat data presentation

Both adversarial reviews endorsed the direction and tightened it hard. The
staff console and confirmation polish (in v1's secondary/tertiary) are
DEFERRED to iters 5-6 — reviewers showed the staff console needs a real
inline member search (not a chat-launcher menu) to be worth doing, which is
its own iteration. Iteration 4 = the locked instructor-photo requirement +
rich in-chat cards, done safely.

## A. Instructor photos (LOCKED requirement)

- Photos bundled at `public/instructors/{sofia-martinez,marcus-lee,avery-thompson}.jpg`.
  Map by instructor name; **initials-avatar fallback** for any unmapped name.
- **Geometry**: true CIRCLE (distinct from the squircle card language) —
  40px on `/appointments` cards, 32px in the in-chat schedule card.
- **Ring**: `box-shadow: 0 0 0 2px var(--color-surface), 0 0 0 3px var(--color-border)`
  (white gasket + hairline, echoing `.bot-status span`). On interactive/hover
  cards, the outer ring becomes the class-type color (teal/violet/warning) so
  the photo joins the type-coding system.
- **Composition**: pull the instructor OUT of the small-print meta row. Photo
  + instructor name (`color: var(--color-ink)`, weight 700) sits as a unit
  near the type badge — equal visual weight, "a person runs this class."
- **Initials fallback**: identical circle+ring geometry; `background:
  var(--color-violet-subtle)`, initials in `var(--color-violet-dark)` Baloo.
  NEVER a solid teal/magenta fill with white text (contrast fail). Never a
  flat gray disc.
- **Alt text (CORRECTED from v1)**: `alt=""` — the instructor name is
  adjacent visible text on every card, so a named alt double-announces to
  screen readers. Decorative empty alt; the name text carries the meaning.
- **CLS**: explicit `width`/`height` on every `<img>`; `loading="lazy"` ONLY
  for below-the-fold instances (first visible day's cards eager). The
  `ClassCardSkeleton` gains a matching circle placeholder now.
- **PII**: fine (fictional instructors, bundled royalty-free). Do NOT extend
  photos to member cards — that would be real user data.

## B. Rich in-chat cards (additive, non-breaking, a11y-correct)

### Contract safety (non-negotiable — usability review)
1. Extend the intent result additively to `{ reply: string; data?: ...;
   card?: RichCard }`. **`reply` stays the full, self-sufficient
   plain-language summary it is today** — never truncated to a stub because
   a card exists. Existing intent tests on `reply` must stay green.
2. `RichCard` is a real **discriminated union**
   (`kind: 'schedule' | 'members' | 'workout' | 'outreach'`), not `unknown`,
   so the renderer's `switch` is exhaustively type-checked.
3. Verify `/api/chat`'s route handler forwards `card` in the JSON response
   (must not destructure `{ reply }` only and drop it).
4. **aria-live split (non-negotiable)**: only the `reply` text stays inside
   `aria-live="polite"`. The `card` renders as a NON-live sibling block
   (no live attribute), with its own heading, so interactive card controls
   are never injected into a polite-announce region. Card container gets a
   concise `aria-label` per kind.
- When a card renders, the message bubble still shows the `reply` text
  (a11y + fallback channel); the card renders attached below it. Do not gut
  `reply` to avoid redundancy — the mild text+visual overlap is the correct
  two-channel design.

### Card designs (COMPACT — do not port the 278px `/appointments` card into
the 380px overlay)
- **Schedule** (highest-leverage, per art director): dense rows — 32px
  instructor photo + class title + time on one line, ONE status badge,
  reuse the type-color left-rule. Cap at 3 visible + a "+N more — view full
  schedule" link to `/appointments`. Reduced fields (title, instructor unit,
  time, one badge); "spots left" detail lives in `reply` text, not a 2nd
  badge. Reuse `ClassCardSkeleton` for its loading state.
- **Members**: NO class-type left-rule (that vocabulary belongs to classes),
  NO photo (avoid conflating with instructor photos / PII). Initials avatar +
  name + one status line as `badge-neutral`.
- **Workout**: numbered exercise blocks with aligned columns (exercise name
  left, sets×reps right) — NOT prose in a bordered box.
- **Outreach**: heaviest visual weight (it's the send-gate). Dashed or
  `--color-warning` accent, explicit "Nothing sent yet" microcopy. Send
  button = `.btn-secondary` (ink), NOT the celebratory `.btn-primary`
  gradient; edit = outline.
- **All cards**: reuse the existing `-subtle` bg + `-dark`/ink text badge
  token pattern mechanically. NO new solid teal/magenta fills with white
  text anywhere. Keep color+text pairing (never color-only), following the
  existing "Full"=`badge-danger`+text precedent.

## Deferred (with reviewer rationale)
- **Iteration 5**: `/staff` console — but done RIGHT: at least Member Lookup
  is a real inline search-to-results on the page (reuse the member card),
  not a chat-launcher. Other tiles may deep-link to FitBot with honest "Ask
  Fitbot" copy; launcher tiles are `<button>`, preset auto-sends or announces
  via a live status, close returns focus to the originating card.
- **Iteration 6**: confirmation/mutation states (booking confirm, outreach
  send-gate) polished into the system + any cohesion/tech-debt cleanup.

## Verification for this iteration
- lint + build green.
- Live: `/appointments` cards show instructor photos (40px, ring, correct
  composition); a schedule query in FitBot renders the compact schedule card
  with 32px photos (not a text wall); functionality intact (booking still
  works, reply text still present); the `reply` text still appears (contract
  intact). aria: card is outside the live region.
- Regression audit: focus-visible / aria-label / aria-live counts preserved
  or increased; no CLS on card images.
