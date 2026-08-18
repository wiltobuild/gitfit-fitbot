# Review: Landing page + chat UI scaffold

_By Themis._

## Must-fix

1. **Fonts declared but never loaded (initial pass only — since fixed).** `app/globals.css` referenced `"Baloo 2"` and `Inter` by name, but no `next/font/google`, `next/font/local`, `<link>`, or `@font-face` existed anywhere — the site silently fell back to system fonts, contradicting acceptance criterion 2 and the plan's explicit font-loading decision.
   - **Resolution**: follow-up Codex pass added `next/font/google` for `Baloo_2` and `Inter` in `app/layout.tsx`, exposed as CSS variables (`--font-baloo-2`, `--font-inter`), applied at the root, and `app/globals.css` updated to reference the variables. Re-verified live: `getComputedStyle(h1).fontFamily` → `"Baloo 2", "Baloo 2 Fallback", ui-rounded, sans-serif`; `getComputedStyle(body).fontFamily` → `Inter, "Inter Fallback", ...`. Build passes with fonts fetched successfully in a network-enabled environment.

## Optional

1. No length cap on chat input, client or server (`app/api/chat/route.ts`, `chat-experience.tsx`). Low severity for an in-memory stub — worth a cheap `slice(0, N)` guard before real traffic. Deferred, not required for this task.
2. `postcss.config.mjs` anonymous default export lint warning — accepted, non-blocking.
3. All dependency versions pinned to `"latest"` in `package.json` — fine for a scaffold, will drift; revisit once the stack stabilizes.

## Scope drift

None. No tool-manifest, JWT/auth, or error-shape code touched. No real LLM call, no persistence, no teammate integration, no deployment config. Brand hex values match `docs/build-doc.md` exactly. Gradient confined to the primary CTA button and chat send button only — no bubble/body-text gradient fills. Message content rendered via plain JSX interpolation, no `dangerouslySetInnerHTML`. No hardcoded secrets. `.env.example`/`.gitignore` correct. `package-lock.json` present. API route rejects non-string/empty input with 400; client fetch wrapped in try/catch with graceful fallback.

## Note (informational, not a defect)

The repo's `CLAUDE.md` contains a block appended automatically by `next dev` itself (Next.js 16's "agent rules" generation feature — confirmed via the dev server's own log line: `✓ Generated CLAUDE.md for AI agents. Set agentRules: false in next.config to disable.`). It instructs any AI agent reading the file to consult `node_modules/next/dist/docs/` before writing code. This is genuine Next.js tooling output, not injected content, and was not acted on beyond noting it here. Can be disabled via `next.config.ts` (`agentRules: false`) if unwanted.

## Verdict

**Ready for verification** (Apollo) — the must-fix finding was resolved and independently re-verified live before this review was finalized.
