# Tasks

Each task run through `/start-task` gets its own directory here, named by a
short slug (e.g. `docs/tasks/example-task-slug/`).

Documentation level for this project is **Standard** (see
`docs/agent/project-profile.md`), so each task directory typically contains:

- `brief.md` — scope, acceptance criteria, preflight state
- `investigation.md` — Argus findings
- `plan.md` — Athena's plan and decisions requiring approval
- `review.md` — Themis's review of the implementation
- `verification.md` — Apollo's verification report
- `final-report.md` — what changed, what was verified, what remains

Tasks touching the shared contract (tool manifest format, JWT/auth claim
shape, or error response shape — see `docs/build-doc.md`) get the elevated
approval-gate row in `docs/agent/workflow.md`: an extra explicit sign-off
recorded in `docs/agent/decisions.md` after implementation, on top of the
usual pre-implementation approval.
