# Iteration 3 — Elevation Plan v1 (pre-review draft)

## Where we are after iters 1-2

- Iter 1: dark emissive hero + MomentumArc motif + dashboard hierarchy +
  tinted shadows.
- Iter 2: MomentumArc became a FUNCTIONAL data-driven ring (real
  bookings-this-week), module-grid hover gradient reveal, schedule quiet
  type-rules + typography, fixed a real contrast bug, CSS spring easing.

The system now has: a bold dark register (hero + dashboard FitBot tile), a
signature motif that MEANS something (the ring), a quiet-but-gradient-aware
white register, and honest data viz.

## What's still uneven (the finishing 20%)

- **FitBot** stayed on its white surface (correct — dark chat was
  rejected), but it still reads as the least-elevated surface: stock
  bubbles, a generic 3-dot "typing" indicator, plain suggested chips. The
  reviewers said: keep it readable/white, give it identity via the motif +
  violet accents, not darkness.
- **The spring motion + motif appear in only a couple places** — not yet a
  consistent language across FitBot open, card entrances, loading, empty
  states.
- **Auth pages (sign-in/up)** got a faint wash in the overhaul but predate
  the motif/dark-register language — they feel a step behind now.
- **Loading/empty states** are skeletons/text — the signature motif could
  make them feel designed and on-brand.

## Iter-3 thesis: COHESION. Make the motif + motion a consistent language,
## and finish FitBot + auth to the same bar — no new bold registers.

1. **MomentumArc as the functional loader/thinking state** — reuse the
   signature motif as a spinning/animating arc for: FitBot's "thinking"
   indicator (replaces the generic 3 dots), and the appointments loading
   state (alongside/replacing bare skeletons). This is the art director's
   "make the motif functional, not decorative" applied to motion — a
   spinning progress arc IS a loader, so the reuse is honest and
   purposeful, not ornamental.

2. **FitBot identity on its (readable, white) surface** — refine the
   overlay/launcher without going dark: momentum-arc thinking state,
   a subtle violet-accented assistant avatar, more polished suggested-
   action chips (the gradient-border-on-hover language from the module
   grid, at chip scale), a spring open transition. Keep all text on the
   current high-contrast readable surface (per the a11y review — do NOT
   darken the message area).

3. **Consistent athletic motion** — apply the existing CSS `--ease-spring`
   to the remaining entrance/success moments for one motion personality:
   FitBot open, booking-confirmed, dashboard ring entrance (the number/arc
   animating in), card entrances. All CSS-only, inside the reduced-motion
   guard.

4. **Auth pages to the same bar** — bring sign-in/sign-up up to the
   elevated language: a restrained momentum-arc/gradient accent moment on
   the page (not a full dark surface — keep the form readable on light),
   consistent spacing/type with the rest. Small, cohesive, not a redesign.

5. **On-brand empty/loading states** — the appointments empty state and
   any bare loaders adopt the motif so "nothing here yet" feels designed.

## Guardrails (carried forward, non-negotiable)

- No new dark text-dense surfaces (FitBot message area stays readable
  light). No brand color as body text on light. Per-color-verified
  contrast on any fill.
- Motion CSS-only, inside the prefers-reduced-motion guard; a spinning
  loader must also stop/simplify under reduced-motion.
- The functional ring's honest-data framing stays (no fabricated metrics).
- Restraint: this is a cohesion/finishing pass — do NOT add new loud
  elements, blobs, or a third register.

## Open questions for reviewers

- Is the spinning-arc loader legible as "loading," or ambiguous vs. the
  dashboard's static progress ring (same motif, two meanings)?
- Does finishing FitBot on a white surface leave it feeling second-class
  vs. the dark hero, or is motif+motion enough identity?
- Where does a "cohesion pass" risk becoming busywork / over-polishing
  vs. real improvement?
- Anything still MISSING for a genuine "commercial launch" bar after 3
  iterations?
