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
