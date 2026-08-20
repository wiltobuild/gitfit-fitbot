# Design Elevation Loop 5 — Summary

Single-pass session, not the multi-agent adversarial-pair process used in
loops 1-3 — user asked directly for a design critique of `/staff` (Manager
console) via the `frontend-design` skill, then said to prioritize and
implement from the findings myself rather than approve item-by-item, then
in a follow-up message asked for the remaining two items too. Palette/
typography untouched throughout, per the user's constraint.

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

## Follow-up pass — items 1 and 3 (visual tiering + the color-system finding)
User asked to go through the remaining two items from the original
critique. Re-examined finding 1 (wall of identical white cards) and
finding 3 (color-system unification, previously marked "already
consistent, no change") together, because they turned out to be the same
opportunity: rather than leaving the color-consistency finding as a
no-op, used the *already-consistent* warning/danger tokens to draw a real
throughline from the new ops-band signal dots to the specific panels they
describe.

**What changed**: `app/staff/requests-inbox.tsx` and
`app/staff/at-risk-members.tsx` now conditionally add
`staff-panel-flagged staff-panel-flagged-warning`/`-danger` to their
`<section>` when there's actually something pending (`requests.length` /
`totalCount` > 0) — a 3px top-border accent in the same
`var(--color-warning)`/`var(--color-danger)` used by the ops-band dots,
reusing the exact border-shorthand-override technique `.staff-pulse-card`
already established (1px neutral border + 3px colored top, later in
source order so it wins). `app/globals.css` gained
`.staff-panel-flagged*` (3 short rules). This is the only tiering change
made — Studio Pulse, Live Register, Activity Log, Member Search, and
FitBot tiles stay plain white on purpose; only the two panels an ops-band
signal actually points at get flagged, and only while the count is
nonzero, matching the panels' own "quiet when empty" copy.

Verified the same way: `tsc --noEmit` clean, mock rebuilt with the new
conditional classes against the freshly compiled CSS, screenshotted —
amber top-border on Requests Inbox, red on At-Risk Members, both
traceable to their header pill's dot color.

Committed on `operations-dashboard`, not pushed.
