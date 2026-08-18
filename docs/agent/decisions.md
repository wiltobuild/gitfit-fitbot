# Decisions Log

_Append-only. Each approved decision goes here so it is not re-litigated in a
later session. Newest at the bottom._

## 2026-08-18 — Documentation level: Standard

Standard documentation level (full `docs/tasks/<slug>/` artifact set per
task) chosen over Lightweight.

**Why**: 4-person team relying on a shared contract (tool manifest, auth
shape, error shape) between independently-built products — contract
decisions need to be traceable so teammates aren't broken by undocumented
changes.

**Approved by**: user

## 2026-08-18 — Approval gate: shared-contract changes need sign-off

Beyond the global approval-gate defaults, any change to the tool manifest
format, JWT/auth claim shape, or error response shape requires explicit user
approval before implementation, and gets elevated Themis scrutiny plus a
recorded sign-off after implementation.

**Why**: These three things are exactly what docs/build-doc.md identifies as
the load-bearing contract every teammate's product depends on — changing
them after teammates have built against them means touching every product
at once.

**Approved by**: user

## 2026-08-18 — Data sensitivity: no special handling required

No elevated data-safety/PII handling requirements for this project beyond
normal secret hygiene (`.env`, gitignored).

**Why**: User explicitly opted out of the health-data-sensitivity treatment
suggested in docs/build-doc.md for this project's scope.

**Approved by**: user

## 2026-08-18 — Git strategy: main branch, no push/PR policy yet

Work happens directly on `main` (no feature branches by default), small
commits per approved phase, no auto-push. No remote/push policy configured
yet.

**Why**: Fresh solo-owned repo; user confirmed this default during
bootstrap.

**Approved by**: user

## 2026-08-18 — Ship date: Friday, Aug 28, 2026

Confirmed real deadline, replacing the fabricated 6-week "Suggested
Timeline" section that was in the source of docs/build-doc.md (removed).

**Why**: User corrected the timeline pasted into chat — the doc's own
"Suggested Timeline" section was not accurate to the team's actual schedule.

**Approved by**: user
