# Design Elevation Loop 2 — Summary (iterations 4-6)

Same process as loop 1: each iteration = a plan, TWO independent adversarial
Sonnet-5 UI/UX reviews (art-director lens + usability/a11y or perf lens), a
reconciled plan from their feedback, Codex implementation, live verification,
commit. Mid-loop the user steered: "each loop should add much more meaningful
visual identity... add animation... a quick loading screen between pages...
uplift it to look more like professional software within the niche." Iters 5-6
were scoped up accordingly.

## Iteration 4 — commit 45397ae — instructor photos + rich in-chat cards
- Locked user requirement: real human instructor portraits on class cards
  (bundled royalty-free, 40px circle w/ type-colored hover ring, pulled up to
  a person-unit beside the type badge; initials fallback; decorative empty alt
  because the name is adjacent).
- FitBot replies stop being plain text: RichCard discriminated union
  (schedule/members/workout/outreach), emitted additively by 4 handlers whose
  full reply strings stay intact (contract preserved), /api/chat now forwards
  the card, and the card renders OUTSIDE the aria-live region (interactive
  controls must not sit in a polite-announce container). Verified via live API
  call returning full reply + typed schedule card.

## Iteration 5 — commit 20e40cf — pro nav + route progress bar + ring-charge
- Route-aware persistent app nav (Dashboard/Book/FitBot/Staff, staff-gated),
  active route marked with a gradient underline + aria-current — the biggest
  "not pro software" tell fixed.
- Global thin top progress bar on navigation (not a full-screen splash; both
  reviews rejected that). Codex verified the Next 16 nav API itself.
- Signature "ring charge": the MomentumRing number counts up in sync with its
  stroke-fill (rAF, tabular-nums, reduced-motion renders final value instantly).
- Cut by review as dishonest/gimmicky: a KPI stat band (only one real metric),
  scroll-reveal, blanket template.tsx entrance, and framer-motion.

## Iteration 6 — commit 11c0f31 — real staff operations console
- Placeholder /staff becomes a dark-register ops console: live capacity stat
  from today's real classes, a "Today at the studio" register with instructor
  photos + fill-level bars, a REAL staff-gated inline member search
  (/api/staff/members mirroring /api/chat auth, RPC is_staff as defense in
  depth, debounced+abortable, initials-only avatars for member PII, count-only
  aria-live), and honest "Ask FitBot" tiles with generic (no-PII) presets.

## Guardrails held throughout
Contract-additive (no router/intent regression), server-side authz for the new
staff endpoint, no member PII in avatars or chat presets, WCAG-safe color
(never white-on-teal, color always paired with text), reduced-motion for every
JS animation, and no-mocked-data (every number shown is real).

Committed locally on main (5 commits, iters 4-6); not yet pushed.
