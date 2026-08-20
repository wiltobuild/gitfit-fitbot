# Final report: fitbot-capability-expansion

## What changed

Unified rollout of a three-tier role model (client/staff/admin) and a
significant Fitbot capability expansion, implemented in 7 phases per the
approved plan (`plan.md`), each reviewed and verified before the next
started:

1. **Schema** — `admin` role added, 4 named accounts promoted, admin-only
   time-off UPDATE policy (migration `0014_admin_role.sql`).
2. **Role-comparison sweep + chip auth gate** — every `role === "staff"`
   call site across the repo made admin-aware; chips gained a second,
   compiler-enforced role-check layer (`CHIP_ROLES` in `chip-labels.ts`,
   checked in `app/api/chat/route.ts` before any handler runs).
3. *(folded into Phase 4 below in actual execution order)*
4. **Admin time-off approve/deny** — new `time-off-review` intent +
   `pending-time-off` chip.
5. **New cards + 4 new capabilities** — `booking`/`capacity` RichCard
   kinds, `studio-capacity`, `instructor-classes`, `class-info`,
   `roster-summary`.
6. **Intent-matching confidence scoring** — replaced first-match-wins
   boolean matching with a trigger+entity score across all 19 intents;
   the router picks the single highest-scoring role-authorized intent.
7. **Defense-in-depth chip filter** — client components now also filter
   `suggestedChips` through `CHIP_ROLES` using the role the server just
   returned, on top of the server-side filtering that was already correct.

## What was verified

See `verification.md` for the full matrix. In summary: role gating is
correct in both directions (admin sees everything staff sees plus
approve/deny; client is scoped to chatbot + appointments + dashboard only,
confirmed via a real client session hitting both a free-text attempt and
the `pending-time-off` chip and getting blocked both ways); every new
capability works end-to-end against real data; lint and typecheck are
clean at every phase.

## What was found and fixed along the way

See `review.md` for the full list. Highlights: a completely non-functional
approve/deny capability in Phase 4 (wrong identity source), a broken regex
that silently disabled time-of-day filtering, a lifecycle-status spelling
mismatch that dropped at-risk members from a staff-facing card, an
additive-vs-multiplicative scoring bug in 3 intents that let them hijack
unrelated messages, and a pre-existing (not introduced by this build)
database function gap that had been silently degrading two features. All
fixed and verified live before their respective phase was committed.

## Deployment status

- Phases 1–4 are committed, pushed to `origin/main`, and live on Vercel —
  this resolved the mid-build regression where the admin role existed in
  the database but the deployed code didn't yet understand it.
- Phases 5, 6, and 7 are committed locally but **not yet pushed** — held
  back pending explicit go-ahead, per instruction during the session.
- Migration 0015 (the `list_members_for_staff()` column fix) has already
  been applied directly to the live database, independent of the code
  push — the deployed code doesn't yet use the new columns until Phase
  5/6's code ships, but the migration itself is live and backward
  compatible (existing columns unchanged).

## What remains open

- Push Phases 5–7 to `origin/main` when ready.
- The 3 duplicate test time-off rows created during this session's live
  testing (Wil Sheppard, Fri Aug 21) are harmless leftover test data, not
  cleaned up.
