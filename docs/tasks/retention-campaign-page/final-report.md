# Final report: retention-campaign-page

## What changed

Integrated a teammate's "Fitbot Reconnect" mockup as a real, staff/admin-only
`/retention` page — a bulk re-engagement campaign builder connected to
GitFit's real data and real (in-app) delivery, not a disconnected demo.
Delivered across 7 phases:

1. **Schema** — bounded day-range cohort querying, a staff-targeted
   `chat_messages` INSERT policy, and an `is_promotional` marker column.
2. **Data layer** — cohort lookup, batch draft creation, promotion
   lookup, and a real weekly member-activity aggregation.
3–4. **Page shell** — gated `/retention` route, nav entry, 9 new
   hand-authored icons (no new dependencies), CSS built on GitFit's real
   design tokens.
5. **Interactive experience** — real cohort selection, editable campaign
   fields, a message composer with an honestly-scoped incentive toggle, a
   live preview using a real cohort member, and a real (not mocked)
   activity trend chart.
6. **Real delivery** — launching a campaign creates real staff-reviewable
   drafts; sending (bulk or the pre-existing single-member flow) now
   genuinely delivers into the recipient's own FitBot chat history.
7. **Surfacing delivery elsewhere** — a dashboard Promotions card and an
   automatic FitBot popup on next page load when an unseen promotion
   exists.

## What was verified

See `verification.md` for the full matrix. Everything was checked against
real data with real sessions, not static reasoning: role gating in both
directions, live cohort counts, a full campaign launched against a real
24-member cohort, two real deliveries confirmed via direct database query
(not just "no error"), the dashboard card and auto-popup confirmed as an
actual recipient, a mobile-viewport layout check, and a full branding grep.

## What was found and fixed along the way

See `review.md`. Four real bugs, all caught by live verification rather
than static review, all fixed in the same phase they were found:

1. A Postgres function-overload gap in the Phase 1 migration.
2. A personalization token (`"[First name]"`) that was never resolved
   before real delivery — the single most important bug, since it would
   have shipped every recipient's name as a literal placeholder string.
3. A structural RLS gap that made the entire dashboard Promotions card
   non-functional for every real member, regardless of how correct the
   application code was — only caught by testing as an actual member
   account, not an admin.
4. The same unresolved-token bug recurring on a second surface (the
   dashboard preview), fixed by sharing one implementation instead of two.

This is a strong argument for the pattern used throughout this task:
verifying as the actual affected user (a real client account, not just
admin) surfaced two of the four bugs that reasoning about the code alone
would have missed entirely.

## Deployment status

All 7 phases, plus migrations 0016 and 0017, are committed and were
applied directly to the live database as each phase landed (following
this session's established pattern of shipping schema before code where a
later phase depends on it). Code is pushed to `origin/main` as of this
report — Vercel should have the live app fully caught up.

## What remains open

- Real push/email/SMS delivery remains explicitly out of scope, per the
  approved plan — "delivery" in this feature means the recipient's own
  FitBot chat, not an external notification channel.
- The 24 draft `outreach_messages` rows and 2 real deliveries created
  during live verification are real data, left in place (synthetic seed
  accounts, low-stakes, consistent with how this session has handled test
  data elsewhere) — not cleaned up.
