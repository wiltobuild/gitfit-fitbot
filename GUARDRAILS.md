# Guardrails
Lessons learned on this project. Each entry: what triggered it, the rule that
prevents it, why it matters. Read at the start of every task.

## `.next/types` duplicate-file cruft can make standalone `tsc --noEmit` lie

**Trigger:** During batch-1 step 3 verification, `npx tsc --noEmit` failed
with type conflicts in `.next/types/*d 2.ts` — stray macOS "space 2" duplicate
files, most likely from two Next.js processes (the running dev server plus a
concurrent `npm run build`) both writing generated types to `.next/` at once.
`npm run build` (which runs Next's own typecheck against real source) passed
cleanly at the same time.

**Rule:** If `npx tsc --noEmit` fails but the errors are confined to
`.next/types/`, don't treat it as a real typecheck failure — cross-check with
`npm run build` (authoritative) before concluding anything is broken. `.next/`
is gitignored/regenerated, never hand-edit or "fix" files in it.

**Why it matters:** A verify step could wrongly FAIL/block a working step on
phantom errors that have nothing to do with the actual change, burning an
attempt for no reason.

## `npm run build` can transiently fail with ENOTEMPTY on `.next/server`

**Trigger:** Recurred twice during the realtime-booking-updates task (steps
3 and 4 verify passes) — first `npm run build` invocation fails with
`ENOTEMPTY` on `.next/server` during an rmdir; a second run immediately
after succeeds cleanly. Root cause is almost certainly the background dev
server (`npm run dev`, running continuously on port 3001 across this whole
session) writing to `.next/` concurrently with the one-off `npm run build`
verification runs.

**Rule:** If `npm run build` fails with `ENOTEMPTY` (or another filesystem
race error) touching `.next/`, retry once before treating it as a real
failure. Do not `rm -rf .next` or otherwise delete/edit `.next/` contents
(also blocked by tooling guardrails) — it's regenerated automatically and
manual intervention isn't the fix for a transient concurrent-write race.

**Why it matters:** Same class of problem as the tsc/`.next/types` entry
above — a flaky, unrelated filesystem error could wrongly burn a retry
attempt on a step that's actually correct.
