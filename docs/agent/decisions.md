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

## 2026-08-18 — Architecture pivot: repo owns the GitFit suite's data directly, not just the chatbot orchestrator

Supersedes the "chatbot as orchestrator over teammates' independently-built
products, no shared database" model in `docs/build-doc.md` and the original
`docs/agent/project-profile.md` Identity section. Going forward, this repo
owns schedule, appointments, member, attendance, and retention data
directly (via Supabase), and the chatbot becomes a deterministic-first
intelligent interface over that data plus an LLM fallback for open-ended
requests — not a pure tool-calling orchestrator against external teammate
APIs.

**Why**: User request to build "GitFit Suite" as one unified product with a
persistent chatbot overlay, Supabase auth/roles, and staff/client
capabilities that require owning schedule/member/retention data directly —
not achievable through the read-only, contract-only orchestrator model.

**Open flag, not yet resolved**: user confirmed the capstone is "still a
4-person team" (teammates still own their separate products) in the same
answer as approving this pivot. Read together, the working interpretation
is: the broader capstone team context is unchanged, but *this repo* is no
longer waiting on or integrating with teammates' separate builds via the
shared contract — it builds the suite's data/features natively. The
existing `pulse-studio-prototype` submodule embed at `/appointments`
(`appointments-prototype-embed` task) is therefore legacy/decorative under
the new direction, not a dependency to keep building against. Flagged for
user correction if this reading is wrong.

**Approved by**: user

## 2026-08-18 — New dependency: Supabase (auth + Postgres)

Adds Supabase for authentication, role-based access (client/staff), and
primary data persistence, replacing the build-doc.md-suggested generic
Postgres/SQLite + custom shared-JWT scheme.

**Why**: User request explicitly specifies Supabase for auth and role
handling as the foundation the rest of the suite (schedule, appointments,
member lookup, chatbot permissions) is built on.

**Approved by**: user

## 2026-08-18 — Role assignment: client self-service, staff by invite/admin only

Signup is self-service for client accounts. Staff accounts are never
selectable on a public signup form — they're created or promoted through a
separate admin-only path.

**Why**: An open role picker at signup would let anyone grant themselves
staff privileges (member lookup, retention outreach, operational data) —
a real security risk even for a capstone project, not just a style choice.

**Approved by**: user

## 2026-08-18 — Phase 1 (Supabase auth + roles) plan approved

Full plan in `docs/tasks/supabase-auth-roles/plan.md` approved as written,
covering: hybrid proxy/helper session enforcement (proxy.ts does cookie
refresh + soft UX redirect only; a shared `lib/auth/session.ts` helper is
the actual enforcement point in every Server Action/Route Handler/page —
required because Next 16's own docs confirm Server Actions can bypass
proxy route matchers); a `profiles` table (not `app_metadata`) as the role
source of truth, RLS-protected, trigger-populated defaulting to `client`;
dashboard-only staff provisioning for this phase (no invite-code or in-app
admin UI yet); a minimal `/dashboard` placeholder as the post-login
destination; unstyled functional `/sign-up`/`/sign-in` forms with no role
picker.

User also supplied `SUPABASE_SERVICE_ROLE_KEY` alongside approval, even
though the plan doesn't require it for Phase 1 — stored in the local
gitignored `.env` for a later phase's in-app staff-promotion flow, not
referenced by any Phase 1 code.

**Why**: See plan.md's per-decision "Why" sections; this entry exists so
the approval itself, not just the reasoning, is durably recorded per the
project's Standard documentation level.

**Approved by**: user

## 2026-08-19 — `pulse-studio-prototype` embed left in place for Phase 2

Phase 2 (suite landing page) links to `/appointments` unchanged rather
than resolving its `pulse-studio-prototype` iframe embed vs. a native
implementation. Deferred to Phase 6 (native Supabase-backed appointments),
which is where this actually needs to be decided.

**Why**: Phase 2's scope is the landing page and shared nav, not
appointments' implementation; forcing that decision here would be scope
creep into Phase 6's job. Partially addresses the open flag left by the
2026-08-18 architecture-pivot decision above — that flag itself isn't
fully resolved (still "still a 4-person team" vs. "full pivot" tension),
just deferred to the phase that actually owns the appointments decision.

**Approved by**: Claude (autonomous execution mode — user explicitly
authorized running phases through Phase 10 without per-decision
check-ins, "I will intervene if you go astray")

## 2026-08-19 — Phases 2-10 run autonomously, adversarial review at Phase 10

User authorized running Phases 2 through 10 of the gitfit-suite-buildout
without per-phase plan-approval check-ins ("I want you to run this on
your own. I will intervene if you go astray."), with two standing
conditions: commit as each phase completes, and run an adversarial review
once Phase 10 lands, then stop before Phase 11 (LLM integration) for a
user check-in.

**Why**: User's explicit instruction, given after Phase 1's plan-approval
cycle demonstrated the workflow works end-to-end; removes per-decision
approval gates for the remaining deterministic-phase work while keeping a
hard stop before the LLM-integration phase and a structured adversarial
check at the natural halfway point.

**Approved by**: user

## 2026-08-19 — Operations Dashboard (Product B) work happens on a feature branch, not main

Work for the `operations-dashboard` task (role split into trainer/manager,
request approval, class management, promotion/certs — see
`docs/tasks/operations-dashboard/`) happens on a dedicated `operations-dashboard`
branch, diverging from the earlier "main branch, no feature branches by
default" git-strategy decision above for this task specifically.

**Why**: User's explicit instruction. This task's owner (the user) is
personally, individually graded on the Operations Dashboard piece within
the shared suite repo — an isolated branch keeps that work reviewable and
revertible independent of whatever else lands on `main` from the rest of
the suite.

**Approved by**: user
