# Design Elevation Loop 5 — Summary

Single-pass session, not the multi-agent adversarial-pair process used in
loops 1-3 — user asked directly for a design critique of `/staff` (Manager
console) via the `frontend-design` skill, then said to prioritize and
implement from the findings myself rather than approve item-by-item.
Palette/typography untouched throughout, per the user's constraint.

## What was reviewed
Live screenshot of `/` (landing) plus a static mock of the Manager console
built from the real `globals.css` (compiled chunk, so `@theme` tokens
resolved correctly) and the actual `app/staff/*.tsx` markup/classes with
realistic dummy data — no throwaway Supabase account needed for a
visual-only review.

## Findings, in priority order
1. **Ops-band header only showed one stat** (today's booked %); a manager
   had to scroll past 2-3 panels to learn there was anything to act on.
2. **Wall of identical white cards** — Studio Pulse, Live Register,
   Requests Inbox, At-Risk, Activity Log, Member Search, and FitBot tiles
   all used the same `surface-card` treatment stacked full-width with no
   tiering between "needs action" and "reference."
3. Layout rhythm was flat (three full-width blocks before the first
   two-column pairing kicked in).
4. Suspected the success/warning/danger status coding might be
   inconsistent across panels (class fill, pulse cards, activity outcomes)
   — **checked, not true**: `staff-fill-*` and `/appointments`'
   `.capacity-section` already map healthy/filling/full to
   success/warning/danger identically. No change made; flagged as
   already-consistent rather than manufacturing a fix.

## What changed
- **`app/staff/page.tsx`**: added `.staff-ops-signals` — pending-request
  count and at-risk-member count as small pill chips in the dark ops band,
  managers only, each hidden when its count is 0 (matches the existing
  "All caught up" / "None flagged" quiet-when-empty voice already used in
  `RequestsInbox`/`AtRiskMembers`). Reordered manager panels: Studio Pulse
  and Requests Inbox now share a `staff-lower-grid` row instead of stacking
  full-width, moving the actionable inbox up from third position to
  second and breaking the card monotony immediately below the header.
  Animation stagger delays tightened (0/60/120/180ms) to match the new
  4-step rhythm instead of the old 5-step one.
- **`app/globals.css`**: new `.staff-ops-signal*` rules reuse the exact
  dark-hero stat-pill shell already proven on `/appointments`
  (`.appointment-stats`) sized down, plus the eyebrow-dot marker pattern
  already used on this same header — no new visual language introduced.
  Fixed a real spacing bug the reorder would have caused:
  `.staff-requests-inbox` carried its own `margin-top:20px` from when it
  sat below Studio Pulse as a standalone block; left in place it would
  have doubled up against `.staff-lower-grid`'s margin and misaligned it
  against its new sibling. Removed (At-Risk/Activity, the existing
  `staff-lower-grid` pair, never had this per-item margin either — this
  brings Requests Inbox in line with that precedent).

## Verification
`npx tsc --noEmit` clean. Visual: rebuilt the static mock with the new
order/markup, screenshotted via `npx playwright screenshot` against the
freshly compiled `globals.css` chunk (confirms the new CSS rules were
actually in Turbopack's output, not just the source file) — signal pills
render legibly (white/near-white text on the dark ops band, not the raw
`--color-warning`/`--color-danger` hex, which are calibrated for light
surfaces and would under-contrast here; only the small solid dot markers
use those tokens directly), grid pairing holds at 1440px, uniform 20px
rhythm confirmed between every section post-reorder.

Not live-verified against real auth/Supabase data — same tradeoff noted
in prior sessions' checkpoint memory, acceptable for a component-level
CSS/JSX change.

Committed on `operations-dashboard`, not pushed.
