# Iteration 5 — Elevation Plan v1 (pre-review) — Motion + route loading + pro uplift

## Direction (user directive, mid-loop)

"Each loop should add much more meaningful visual identity. Add animation.
Have a quick loading screen between pages. Uplift it to look more like
professional software within the niche." Iter-4 (photos) was too incremental
— iteration 5 must be a BOLD identity leap, app-wide, not a tweak.

Three pillars, all reduced-motion-safe, all performance-conscious:

## 1. Branded route-transition loading screen (explicit ask)

Next 16 App Router mechanics (verify against node_modules/next/dist/docs for
this version — the middleware→proxy lesson applies; confirm loading.tsx /
template.tsx conventions before coding):
- `app/loading.tsx` — a root Suspense fallback shown during navigation to a
  new route segment: a quick (~400-700ms perceived), branded full-screen
  interstitial on the paper (or ink-deep) ground.
- The loader mark: a distinct branded treatment — the GitFit wordmark with a
  gradient sweep/shimmer, or a MomentumArc that DRAWS ITSELF once
  (SVG stroke-dashoffset), NOT an infinitely spinning ring (prior loop killed
  the spinning-ring-as-loader for semantic collision with the data ring, and
  reduced-motion freezes an infinite spin at a glitch angle). A one-shot draw
  + fade is professional and reduced-motion-degradable to a static mark.
- Must feel fast: this is a polish signal, never a speed bump. If a route is
  instant, the loader should barely flash (rely on Suspense timing, don't
  add artificial delay).

## 2. App-wide cohesive motion system (explicit ask)

- `app/template.tsx` — re-mounts on every navigation, so each page's content
  runs a subtle staggered entrance (sections/cards fade-up) on arrival.
  Makes navigation feel alive without per-page wiring.
- **Number count-up**: the dashboard MomentumRing value animates 0→actual on
  mount; add a KPI stat band (see pillar 3) whose numbers count up. Uses
  requestAnimationFrame with an explicit `prefers-reduced-motion` guard (JS
  motion isn't covered by the global CSS reduced-motion block — prior loop's
  usability rule).
- **Scroll-reveal** for below-the-fold sections (IntersectionObserver, one
  shot, reduced-motion-safe) — restrained, not everything-flies-in.
- Unify motion tokens: consistent `--ease`/duration scale already partly
  exists (--ease-out, --ease-spring); ensure hover stays --ease-out, spring
  only on one-time entrances/success (carried guardrail).
- Refine micro-interactions: nav link active/hover, button press already
  present — tighten consistency.

## 3. Professional fitness-niche uplift (explicit ask)

What makes Whoop/Peloton/Strava/Oura read as pro software, applied with our
palette:
- **Dashboard stat band**: a row of KPI tiles with animated count-up numbers
  built from HONEST data already available (e.g. classes booked this week —
  already computed for the ring; total upcoming bookings; a streak or
  next-session countdown if derivable). Confident numerals in Baloo, small
  labels, one accent per tile by zone color. This is the single biggest
  "professional software" signal.
- **Navigation refinement**: the current nav is minimal. Consider a more
  deliberate app nav with active-route indication for authenticated users
  (reviewers weigh: persistent side/top nav vs. keep minimal). Restraint per
  the anti-over-design guardrails.
- Depth/texture: subtle, tasteful — not glassmorphism everywhere.

## Guardrails (carried from all prior reviews)
- Reduced-motion: EVERY animation (CSS and JS/rAF) degrades gracefully; JS
  count-up/scroll-reveal need explicit `matchMedia('(prefers-reduced-motion)')`
  checks (global CSS block doesn't catch rAF).
- Loading screen must not add artificial latency or block interaction.
- No new heavy deps (no framer-motion unless justified — prefer CSS +
  small rAF helpers; reviewers weigh whether a motion lib is worth it).
- No layout thrash / INP regressions from scroll-reveal or count-up.
- Count-up numbers must show the real final value immediately under
  reduced-motion, and be correct (no fake/placeholder KPIs — honest data
  only, per the whole project's no-mocked-data rule).
- Contrast/hierarchy unchanged; motion supports hierarchy, never competes.

## Open questions for reviewers
- Loading screen: full-screen interstitial vs. a top progress bar (à la
  YouTube/GitHub) — which reads more "professional software" here and which
  risks feeling like a speed bump?
- Is a KPI stat band honest given the data we actually have, or will it
  invent vanity metrics? Which specific metrics are real?
- Does the app need a real persistent nav, or is that scope creep?
- Motion library (framer-motion) vs. hand-rolled CSS/rAF — worth a dep?
- Highest-leverage single change for "professional software" feel.
- Where's the line where this motion becomes gimmicky (the user explicitly
  wants flashy-but-not-excessive)?
