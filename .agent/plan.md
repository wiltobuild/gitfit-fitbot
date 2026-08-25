# Plan

STATUS: COMPLETE
TASK: Fix retention cohort day-14 overlap — batch 4 of 4 from the full-app
audit (2026-08-24/25). Implemented directly by the orchestrator (no
chuck/cas/dean subagent loop, per explicit user instruction to conserve
session budget, same as batch 3).

## Steps

- [x] 1. Fix overlapping cohort boundaries in app/retention/page.tsx
  - Do: cohortBoundaries = [{7,14}, {14,30}, {31,60}] combined with the
    inclusive-both-ends RPC (search_members_by_attributes: last_visit_date
    <= today-staleAfter AND >= today-staleBefore) means a member exactly
    14 days stale lands in both the 7-14 and 14-30 cohorts, getting
    duplicate outreach and double-counted in cohort totals. Change cohort
    2's minDays from 14 to 15 so no two adjacent cohorts share a boundary
    day (cohort 2/3 boundary at 30/31 is already non-overlapping).
  - Done when: a pure unit test over the cohortBoundaries array asserts no
    two consecutive cohorts share any day (cohort[i].maxDays <
    cohort[i+1].minDays for all i). npm test, build, lint clean.
  - Touches: app/retention/page.tsx.
  - Requirement test: tests/agent_requirements/retention-cohort-boundaries.test.ts

## Notes
- No chuck/cas/dean loop this batch — implemented directly, verified by
  build/lint/test run by the orchestrator. User explicitly authorized this
  deviation to conserve session budget (same as batch 3).
- Fix is in the TS array only (not the SQL RPC) — the RPC's inclusive
  bounds are correct/intentional per-cohort; the bug is purely in how the
  boundary values were chosen (adjacent cohorts sharing day 14).
- Cohort display labels in retention-experience.tsx are computed from
  minDays/maxDays dynamically ("{item.minDays}–{item.maxDays} days
  inactive") — no separate hardcoded string to update.
