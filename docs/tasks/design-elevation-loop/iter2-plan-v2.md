# Iteration 2 — Elevation Plan v2 (post-review, reconciled)

## What the two adversarial reviews changed

Both reviewers independently killed the two boldest v1 items and converged
on the same higher-leverage pivot:

- **Dark FitBot/chat surface → DROPPED.** Usability proved white text fails
  across teal/gradient bubbles (white-on-teal #1FC2AE = 2.24:1; no single
  text color passes a teal→violet→magenta bubble). Both flagged dark chat
  as a real reading-fatigue regression for a dense text surface, and
  "unresolved — don't treat as decided." Not worth the risk this iteration.
- **Colored header bands per class type → DROPPED.** Calendar-app cliché
  that dilutes what the brand gradient means (art director); no single text
  color passes across the three type-color fills (usability).
- **The pivot both reviewers pushed**: make the MomentumArc **functional** —
  a real progress ring driven by honest data — reused across dashboard +
  module grid. This converts "decoration repeated three times" into an
  actual signature motif AND fixes the module grid, which the art director
  says now looks cheap sitting one click past the dark hero.

## Iter-2 scope (reconciled)

1. **MomentumArc becomes a real data-driven progress ring.** Drive it with
   an HONEST metric I actually have: the signed-in user's **classes booked
   this week** (count from the `bookings` table joined to `classes` for the
   current week — a safe, RLS-protected read of the user's own data; the
   dashboard is already a server component that can query this). Present it
   as an oversized number inside the arc (the type-scale-drama moment), with
   the arc filling proportionally toward a soft weekly target (framed as a
   gentle nudge, e.g. "3 of your 4-class week" — clearly a suggestion, never
   presented as a hard goal the user set). If zero booked, an honest empty
   treatment ("No classes booked yet this week — book one"). No fabricated
   streak (no attendance data exists — bookings ≠ attendance).

2. **Module grid gets a treatment that cites the gradient language** (the
   art director's "the two registers must cite each other"). On the
   signed-in landing, the module cards get a restrained hover-state gradient
   border reveal (the brand gradient appears as a thin animated edge on
   hover, gone at rest) + keep the zone-tinted icon chips. This ties the
   quiet white grid to the bold gradient identity without turning it dark
   or permanently loud.

3. **Schedule: quiet type signal + spend boldness on typography/action.**
   Instead of a colored band, the class type becomes a single quiet signal:
   a slim colored left-rule OR the type icon rendered in the type color,
   keeping the existing small text badge. Spend the freed "boldness budget"
   on a larger, more confident class-name treatment and a more prominent
   Reserve action. No full-bleed color fills.

4. **Fix real contrast bugs the usability review surfaced** (do regardless):
   - The existing "N spots left" text is teal #1FC2AE on white = 2.24:1,
     failing AA today. Move teal-as-text to a darker token (ink, or a
     new darker teal) or use the badge fill with ink text. Audit any
     teal-on-white / magenta-on-white TEXT across the app and fix.
   - Any type/capacity color that becomes a fill must use per-color text
     (ink on teal/amber, white on violet) — never one default text color.

5. **Athletic motion — CSS-only.** Add a subtly springy/overshoot easing
   token for entrance/success moments (card entrance, booking confirm),
   quick easing for hovers. MUST be pure CSS (animation/transition) so it's
   covered by the existing `prefers-reduced-motion` block — NO JS spring
   (usability: JS springs escape the CSS guard). Overshoot subtle, not
   bouncy.

## Explicitly dropped/deferred

- Dark FitBot/chat surface (both reviews — readability + contrast).
- Colored header bands (both reviews).
- Edge-breaking overlap (art director: under-specified, reads as z-index
  bug without a real elevation convention; usability: focus-ring/hit-target
  risk). Deferred — not worth the fragility this iteration.

## Guardrails

- Data metric must be honest (real bookings-this-week; no invented streak;
  clear empty state).
- Every new fill uses per-color-verified text contrast (AA 4.5:1 body).
- Fix the pre-existing teal-on-white text failure while here.
- Motion CSS-only, inside the reduced-motion guard.
- Functional ring must degrade gracefully (0 booked, query error).
