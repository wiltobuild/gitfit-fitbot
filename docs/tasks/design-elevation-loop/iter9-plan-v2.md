# Iteration 9 — Plan v2 (reconciled, FINAL iteration): mobile bug fixes

Both reviews converged on precise diagnoses that sharpen v1 considerably —
including catching that both "bugs" already have partial/buggy fixes in
the CSS that need correction, not new code.

## 1. Nav: replace with icon-only collapse (not scroll-fade, not bottom bar)

**Finding**: `globals.css` already has a `@media (max-width:760px)` rule
making `.nav-links` horizontally scrollable (`overflow-x:auto`) — this IS
the "faint gray bar" bug the plan found. Usability confirms it's
insufficient: gesture-only discovery (iOS Safari hides scrollbars by
default), and the resulting `.nav-link` touch height (~33px) is below the
44px minimum.

**Decision**: replace the scrollable approach with icon-only collapse at
the same breakpoint — a pure subtraction (hide the visible label), not a
new pattern. Reuses `.nav-link.active::after`'s existing gradient-underline
mechanism unchanged (just re-center it under the icon alone). This fixes
the root cause (all 4 destinations visible, no scrolling needed) rather
than adding a discovery hint to a pattern that still requires a gesture.

**Non-negotiable requirements (usability):**
- Hide the label via `sr-only`/clip-path, NOT `display:none` — the icon
  SVGs have no `aria-label` today, so hiding the text would remove the
  accessible name entirely. Alternative: add `aria-label={label}` directly
  on each `<Link>` and visually hide the text span.
- `.nav-link` gets explicit `min-height: 44px` (and adequate width) at the
  mobile breakpoint — the icon-only collapse must not accidentally ship a
  smaller target than the label version did.
- Remove the now-superseded `overflow-x:auto` scrollable rule for
  `.nav-links` at this breakpoint — don't leave two competing mobile nav
  treatments in the CSS.
- Icon size bumps slightly (e.g. 17px→20px) to carry visual weight alone.

## 2. Staff class-row overflow: fix the existing arithmetic bug, don't add new rules

**Finding (both reviews independently)**: a `@media (max-width:520px)` rule
for `.staff-class-row` already exists (flex-wrap + `.staff-fill-unit
{flex-basis:100%; margin-left:53px}` + full-width track) — this is
ALREADY the "stack below" fix the v1 plan proposed. The bug: combining
`flex-basis:100%` with `margin-left:53px` makes the block 100% of the
row's width **plus** 53px, pushing it 53px past the row's right edge —
that's the actual observed overflow.

**Decision**: fix the arithmetic (e.g. `margin-left:0` — the avatar-
alignment indent isn't load-bearing for legibility — or `width:calc(100%
- 53px)` if the indent should stay). Verify live at 375px before writing
anything new. Do NOT add a second, possibly-conflicting mobile rule for
this component.

## 3. Chatbot overlay: CONFIRMED already correct — do not touch

Usability verified `width:min(380px,calc(100vw - 32px))` plus its mobile
override already makes the overlay viewport-safe (343px at 375px,
touching no edge, no cut-off). This is where "don't redesign what already
works" applies exactly. The art director's full-bleed/slide-up-sheet idea
is a legitimate future identity upgrade but NOT a confirmed bug and would
add new behavioral surface area in the closing iteration of a loop — noted
as a follow-up opportunity in the final report, not built now.

## 4. Explicitly OUT of scope (flagged as follow-ups, not silently fixed
or silently ignored)
- Pre-existing sub-44px touch targets not introduced by this iteration:
  `.chatbot-overlay-header button` (32px), `.chat-form button` send (36px),
  `.btn-sm` member-search action buttons (36px). These predate iteration 9;
  fixing them now would expand a bug-fix pass into a broader touch-target
  redesign at the very end of the loop. Note them in the final report as a
  recommended follow-up task.
- Any full-bleed mobile FitBot redesign (see #3).

## Verification
- lint + build green.
- Live at 375×812 (actual mobile preset, not assumption): all 4 nav links
  visible/reachable with no scroll needed, active-state underline correct,
  each link has an accessible name via aria-label or sr-only text,
  `.nav-link` touch height ≥44px. Staff console class rows no longer
  overflow — fill bar + numeric fully visible within the card. Confirm
  desktop (1280px) nav is visually unchanged (regression check — the fix
  must be breakpoint-gated correctly).
- Regression audit: focus-visible/aria-label/aria-live before/after;
  confirm no duplicate/conflicting mobile nav CSS rule remains.
