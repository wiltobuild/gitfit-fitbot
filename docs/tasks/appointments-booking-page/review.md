# Review: Appointments booking page

_By Themis._

## Must-fix

None found. Core logic (double-counting avoidance, capacity/credit enforcement, error handling) is sound.

## Optional

1. `lib/appointments-store.ts` uses unchecked type assertions (`as ClassSession[]`, `as Booking[]`) on JSON imports — low risk since the JSON is a one-time verbatim copy, but a shape guard at load time would be more defensive.
2. `request.json()` in the mutation routes is implicit-any before narrowing — functionally safe (guarded by `typeof` checks) but worth tightening if this pattern is reused elsewhere.
3. The mutation routes' error shape (`{error:{code,message,retryable}}`) matches `docs/build-doc.md`'s example error-shape convention exactly. Not a literal edit to the shared contract (nothing published/exposed yet), but a silent convergent-design judgment call by Codex — flagged for the user to bless or override.
4. The inline confirmation panel (`position:absolute` on a `position:relative` card) could clip/overlap on very long class names at narrow viewports — not verified, a CSS edge case outside the live walkthrough.

## Scope drift

None. `app/page.tsx` and `app/chat/chat-experience.tsx` diffs are each a single added `Link`. `app/globals.css` diff is purely additive (new rule block at EOF). Seed JSON files are byte-for-byte identical to `pulse-studio-prototype/*.json`. No `.env`/auth/secrets touched.

## Verdict

**Approve.** Seeding algorithm correctly avoids double-counting (verified by reading the actual code, cross-checked against live-verified figures). No race condition beyond the already-accepted in-memory/HMR caveat (mutations are synchronous). API routes handle malformed input without crashing. No `any`/`@ts-ignore`. Confirmation panel matches plan (GitFit-styled inline, not the prototype's dark modal). Diff to shipped files is minimal and additive.
