# Iteration 2 — Elevation Plan v1 (pre-review draft)

## Where we are after iter 1

Iter 1 established: a dark emissive hero (ink #0E1430 + aurora + gradient
"MomentumArc" motif), the momentum motif reused on the dashboard's dominant
FitBot tile + launcher, brand-tinted global shadows, dashboard hierarchy.
The white-card system elsewhere (appointments, chat, module grid) is now
the *quieter* register by design.

The art-director review's still-open asks: a signature motif used
*consistently* (started, extend it), depth/layering (nothing breaks its
container yet), athletic motion personality (still stock easing), type-
scale drama beyond the hero, and — critically — the FitBot/chat surfaces
should become a real dark "intelligence" zone, not just a violet tint.

## Iter 2 thesis: extend the two register system into the two remaining
## high-value surfaces (FitBot + the schedule), with depth and motion.

1. **FitBot as a dark "intelligence" surface** — the overlay panel and the
   full `/chat` page currently are white. Make the FitBot panel a dark
   emissive surface (same ink-deep register as the hero): dark panel, light
   text, assistant bubbles as subtle raised dark-violet surfaces, user
   bubbles as the gradient/teal accent, the header carrying the momentum
   motif. This gives the AI its own confident visual identity (the review's
   "FitBot needs a distinct surface, not a tint") and reuses the established
   dark register so it reads as the same system.

2. **Schedule: one strong colored treatment per class card** — resolve the
   bar-vs-badge redundancy the usability review flagged. Each class card
   gets a single colored **header band** in its type color (Yoga/Cycling/
   HIIT) carrying the type name — REMOVE the separate type badge (one
   encoding, not two). Capacity stays as red=full / teal=open with the
   numeric "N spots left" label always present (no color-only encoding, no
   magenta). This makes the schedule genuinely colorful and scannable
   without stacking redundant color.

3. **Type-scale drama** — give the appointments page and dashboard one
   oversized expressive number/word moment (e.g. the day's class count, or
   the active day, in large Baloo with tight tracking), matching the hero's
   confidence.

4. **Depth / layering** — introduce tasteful overlap in 1-2 signature
   spots: the class-type header band's icon or the "spots" pill can break
   the card's top edge; the FitBot launcher's momentum arc can overlap the
   avatar. Restrained — 1-2 places, not everywhere.

5. **Athletic motion personality** — replace the single stock
   `cubic-bezier(.16,1,.3,1)` with a brand motion set including a subtly
   springy/overshooting curve for "entrance/success" moments (card
   entrances, booking confirmation, FitBot open), while keeping quick
   linear-ish curves for hovers. Still respect prefers-reduced-motion.

## Guardrails (carried from iter-1 reviews)

- Dark surfaces = light text, verified AA; focus rings stay highest-
  contrast on dark.
- No magenta for scarcity/full; keep red=full, teal=open; numeric label
  always present.
- One colored treatment per card, not stacked encodings.
- Motion inside the prefers-reduced-motion guard; overshoot subtle, not
  bouncy/childish.

## Open questions for reviewers

- Does a dark FitBot panel help (distinct AI identity) or hurt (two
  registers competing, dark chat harder to read quickly)?
- Colored header bands per class type — premium or does it make the
  schedule look like a calendar-app template?
- Is edge-breaking overlap worth the fragility, or a gimmick here?
- Where does iter-2 risk over-reaching now that iter-1 already added a
  dark register?
