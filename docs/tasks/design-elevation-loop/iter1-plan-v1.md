# Iteration 1 — Elevation Plan v1 (pre-review draft)

## Thesis

The current design (post-overhaul) is clean and cohesive but **safe**:
mostly white cards on flat `#F8F7F5` paper, with the gradient rationed to
the wordmark, primary buttons, and the FitBot launcher. The user wants
"more colorful and interesting" while keeping the palette (teal `#1FC2AE`,
violet `#6E3FE0`, magenta `#C43FD6`, ink, paper) and NOT becoming garish.

The move that adds color without chaos: **make color carry meaning.**
Assign each brand hue a semantic zone so color reads as information, not
decoration:

- **Violet = intelligence / FitBot / AI** — the assistant, chat surfaces,
  smart/AI features.
- **Teal = movement / vitality / availability / positive** — classes,
  booking, "available"/success states.
- **Magenta = energy / featured / promotions / peak accent** — highlights,
  hero punctuation, promotional moments.

Everything below applies that system. Restraint still holds: no glow on
every surface, no gradient on every element — color is deployed by role.

## Changes (v1)

1. **Ambient background** — replace the flat paper with a very subtle
   layered ambient: a soft radial teal→violet color-mesh wash behind the
   landing hero and dashboard header (low opacity, ~4-6%), fading to the
   existing paper elsewhere. Kills the sterile blank-canvas feel without
   loud blobs.

2. **Tinted surface variants** — add `--color-surface-teal`,
   `--surface-violet`, `--surface-magenta` tokens (whisper-tint cards, not
   saturated) and a `.surface-card-tinted` modifier. Use for
   categorization: FitBot-related surfaces get violet warmth, class/booking
   surfaces get teal warmth.

3. **Class schedule color-coding** — richer than the current badges: each
   class card gets a colored top-accent bar or left rail in its type color
   (Yoga→teal, Cycling→violet, HIIT→magenta), making the schedule
   instantly scannable and colorful. Type badge stays.

4. **Capacity as color** — replace the plain "6 spots left" text with a
   small colored capacity meter (a thin progress bar or ring) that shifts
   teal→amber→magenta as a class fills. Real data, colorfully presented.

5. **Dashboard module tiles get zone color** — the quick-link tiles
   (currently uniform grey) each adopt their destination's zone color as a
   left accent + icon chip tint (Fitbot→violet, Book a Class→teal, Staff→
   ink/neutral).

6. **Gradient used more expressively, still selective** — a gradient ring/
   border on the single most important focal card per screen (e.g. the
   dashboard's primary "Chat with FitBot" tile, the hero orbit); gradient
   text on the one hero stat/number per screen where one exists. Not on
   every card.

7. **Colored icon chips by zone** — rotate the module/nav icon chip tints
   through the palette per semantic zone instead of all-violet.

8. **FitBot violet identity** — lean the overlay + launcher into violet as
   its signature (it's the "intelligence" zone): violet-tinted assistant
   message bubbles, a subtle violet ambient behind the panel header.

## Explicitly NOT doing (holding the restraint line)

- No gradient fills on body cards, buttons beyond the existing primary
  set, or text at large.
- No animated/floating blobs.
- No saturated full-color card backgrounds (tints stay in the 4-8%
  range).
- No contrast sacrifice — all text stays AA on its background.

## Open questions for the adversarial reviewers

- Is the semantic-zone color system legible, or will users not perceive
  the teal/violet/magenta meaning distinction?
- Does the ambient background wash help or just muddy the clean paper?
- Is the capacity meter genuinely useful or decorative clutter?
- Where does this plan risk crossing from "premium colorful" into
  "over-designed"?
