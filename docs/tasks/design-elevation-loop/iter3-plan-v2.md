# Iteration 3 — Elevation Plan v2 (post-review, reconciled — FINAL iteration)

## What the two adversarial reviews changed

Both converged hard:

- **Spinning-arc loader → DROPPED.** Art director: semantic collision (the
  same mark can't mean both "your real weekly progress" and "please wait").
  Usability: the global reduced-motion override freezes an infinite spin at
  an arbitrary angle (reads as a glitch), AND it collides with the data
  ring. Keep the existing skeleton/3-dot loaders.
- **The real gap is FitBot, and the fix is STRUCTURAL not decorative**
  (both, art director's highest-leverage): FitBot is the app's core product
  surface but still renders text-glyph avatars ("F"/"You"), a stock 3-dot
  typing indicator, generic chips, and zero Baloo — the one surface that
  still looks like a chat-UI tutorial. Redesign its primitives.
- Usability carryover catch: iter-2's module-card hover gradient-border
  fires on `:hover` only — keyboard users miss it. Mirror to
  `:focus-visible`.
- Motion discipline: spring on one-time entrances only; NEVER on
  per-message send/receive or hover; CSS-only; full aria/focus/hit-target
  audit after a cohesion pass.

## Iter-3 scope (final — cohesion focused on the surface that needs it)

1. **FitBot structural identity redesign (the priority)** — on its EXISTING
   readable WHITE surface (dark chat stays rejected). Redesign the shared
   message primitives used by BOTH the overlay and `/chat`:
   - Replace the text-glyph avatars: the assistant avatar becomes a small
     brand mark (a mini momentum-arc or the spark glyph in a violet-tinted
     chip); the user avatar a clean neutral chip. No more literal "F"/"You"
     text as the avatar.
   - Assistant bubbles get a QUIET brand accent echoing the schedule cards'
     colored left-rule — a subtle gradient-hairline (top or left) — the
     "quiet brand on white" language the app already does well. Text stays
     high-contrast ink on light (no darkening the message area).
   - Baloo display type for the "Fitbot" name/label in the header.
   - Suggested-action chips refined with the gradient-border affordance,
     firing on BOTH `:hover` AND `:focus-visible` (keyboard parity).
   - Keep the 3-dot typing indicator (distinct loader shape — do NOT use
     the ring/arc). Light visual refinement OK, but it must stay visually
     distinct from the MomentumRing.
   - Spring easing on FitBot OPEN only (one-time). NOT on message
     send/receive.

2. **Auth pages — one concrete quiet anchor** — add a large, quiet, blurred
   MomentumArc behind the form card so signed-out auth rhymes with the
   hero. STRICTLY decorative: low opacity, heavily blurred, `pointer-events:
   none`, positioned away from the form fields and the violet focus ring
   (do not let it sharpen into a legible shape near labels or overlap the
   `.field-input:focus` ring). Form stays fully readable on light.

3. **Fix the iter-2 hover-only gap** — the `.module-card` hover
   gradient-border reveal must also fire on `:focus-visible` (keyboard
   parity), same rule applied to the new FitBot chips.

4. **Motion discipline (enforce)** — `--ease-spring` for one-time
   entrance/success only (FitBot open; the ring/booking-confirm already
   use it). Explicit exclusions: NO spring on chat message send/receive,
   NO spring on any `:hover` (hover stays `--ease-out`). CSS-only; no
   JS/RAF animation.

5. **Regression audit (mandatory)** — because restyling many small
   components drops a11y silently: after implementation, grep-verify the
   COUNT of `:focus-visible` rules, and that every `aria-label` (icon
   buttons: launcher, close, send), `aria-live` (message list,
   field-error), and `sr-only` label survives, and no hit target shrinks.
   Report the before/after counts.

## Explicitly dropped/cut (per both reviews)

- Spinning-arc loader / motif-as-loading-state (semantic collision +
  reduced-motion glitch).
- Motif in empty/loading states (iter-3 v1 item 5 — cut per usability;
  reintroduces the ring ambiguity in a second location for marginal gain).
- globals.css legacy-block consolidation — real tech debt the art director
  flagged, but a large CSS refactor in a cohesion pass is exactly where
  focus/aria states get dropped (usability's core warning). Left for a
  dedicated cleanup task, not risked here.

## Guardrails

- FitBot message area stays light/readable (no dark surface, no brand
  color as body text).
- Any new fill uses per-color-verified contrast (ink on teal/amber, white
  on violet).
- All motion CSS-only, inside the reduced-motion guard; spring on one-time
  events only.
- No a11y regression: focus-visible, aria, hit targets all preserved
  (grep-verified).
