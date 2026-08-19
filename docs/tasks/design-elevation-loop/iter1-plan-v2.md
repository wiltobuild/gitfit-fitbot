# Iteration 1 — Elevation Plan v2 (post-review, reconciled)

## What the two adversarial reviews changed

**Both reviewers independently rejected the core of v1** (tinting many white
cards + a capacity meter). Synthesis:

- Art director: the white-on-white *structure* is the problem; tinting is
  low-leverage. Commit to ONE bold dark, color-emissive surface (ink bg,
  gradient as light). Kill the orbit cliché. Add a signature motif + one
  oversized type moment per screen. Tint the generic grey shadows.
- Usability skeptic: cut the class-type accent bar (redundant with the
  badge). Cut magenta from any capacity signal (collides "featured" with
  "full" — keep red=full, teal=open, numeric label always). The zone-color
  system must never reuse the class-type badge hues. Cap tints, recheck
  muted-text contrast, keep focus rings highest-contrast.

**The reconciliation**: don't tint many white cards — make **bold dark
register-shifts in a few focal locations** and keep the working white cards
clean. This is more premium (art director's #1) AND safer for
contrast/hierarchy (light-on-dark is inherently high-contrast; fewer
competing color encodings).

## Iteration 1 scope (a coherent, shippable register shift — iters 2-3 push color further with the discipline this establishes)

1. **Dark emissive hero (signed-out landing)** — replace the dated
   orbit-with-floating-tags graphic entirely. Rebuild the hero as a
   confident **ink surface** (deep indigo, ~`#0E1430`–`#141B3C`) with the
   brand gradient rendered as *light*: a soft, blurred radial aurora
   (teal/violet/magenta, low opacity) emanating behind the content, and a
   **signature "momentum arc"** — an SVG arc/stroke with a teal→violet→
   magenta gradient, rounded caps — as the hero's focal graphic. Light
   (paper/white) text on the dark surface. This is high-contrast and kills
   the cliché in one move.

2. **Signature "momentum arc" motif** — define it once (an SVG component +
   token) and reuse it: the hero graphic, and the FitBot launcher/avatar
   accent, so the suite has ONE ownable visual language instead of three
   ad-hoc color systems. (Capacity-indicator reuse deferred to iter 2,
   done as red=full/teal=open per usability, never magenta.)

3. **Brand-tinted elevation** — replace the generic grey Tailwind-recipe
   shadows with subtly ink/violet-tinted shadows (a real, cheap, global
   premium lift). Keep them soft; this is not glow.

4. **Dashboard hierarchy + zone tiles** — the flattest screen. Make "Chat
   with FitBot" the DOMINANT tile (larger, dark/emissive, carries the
   momentum motif) with the other quick-actions visibly secondary. Give
   each tile a zone identity via **icon-chip tint only**, drawn from a
   zone set that does NOT reuse the class-type badge hues (usability
   constraint): FitBot=violet, Book a Class=teal, Staff=ink/neutral. Add
   one oversized Baloo type moment (the greeting).

5. **Contrast/motion guardrails (non-negotiable, from usability review)**:
   - No brand color as body text on light. Gradient text only where every
     point along the gradient clears its background (dark surfaces are
     safe; light surfaces need per-stop check — avoid on paper).
   - `--color-muted-subtle` and `--color-border` re-checked against any
     new background they sit on.
   - `:focus-visible` outlines stay the highest-contrast ring on every
     element, including the new dark surfaces.
   - Any new motion sits inside the existing `prefers-reduced-motion`
     guard.

## Explicitly dropped from v1 (per both reviews)

- Capacity meter with a teal→amber→magenta shift (magenta collision).
- Class-card colored accent bar (redundant with the type badge).
- 4-8% tinting of many white cards (low-leverage; contrast risk on muted
  text).
- Timid 4-6% ambient wash on many surfaces (invisible — replaced by the
  committed dark hero surface instead).
- Gradient ring/border on focal cards (dated Web3 motif — use a solid
  accent edge or the momentum motif instead).

## Deferred to iterations 2-3

- Appointments schedule: one strong colored treatment per class card
  (a colored header carrying type identity, replacing bar+badge
  redundancy — NOT both), capacity as red=full/teal=open with numeric
  label kept.
- Chat/FitBot panel as a fuller dark-register surface.
- Depth/layering (elements breaking container edges), athletic
  spring-motion personality, type-scale drama on remaining screens.
