# Iteration 6 — Staff Console (reconciled from 2 adversarial reviews)

_Reviews were run during iteration 5's slot, before iteration 5 was
re-scoped to motion/loading. Captured here so iteration 6 implements the
reconciled version._

## Verdict: build it, but with these locked changes

**Composition (art director's highest-leverage):** the console opens
already answering "what does today need from me" — NOT a search-led empty
box (an empty search field is still a menu). Use the DARK register (ops-room
feel, distinct from client-facing white screens):
- Full-width `--color-ink-deep` header band: "Staff — {email}" + date + a
  live capacity stat ("62% booked today"). Explicit empty state if no
  classes today (no blank band).
- **"Today at the studio" panel renders first, above the fold, unprompted**
  — a row list, each row = one class: 40px InstructorAvatar + title/time +
  a fill BAR (fixed ~120px, teal→warning→danger by threshold) with numeric
  "8/12" beside it. Left-border accent keyed to FILL level (teal healthy /
  warning filling / danger full), reusing the class-card left-rule pattern.
  Sort by start time; bold the in-progress/next class. Reserve danger/warning
  badges for genuinely full/near-full — no wall of green "Open" badges.
- Below: two-column row — member search (~60% left) + "Ask FitBot" tiles
  demoted to a ~40% sidebar (they're a footer, not a pillar).

**Member search (the real anchor):**
- Full-width result rows are richer than the 380px chat card: 40px initials
  avatar (NO photo — PII), name + email stacked, membership status badge
  (active=success, past-due=warning, cancelled=neutral — semantic tokens),
  last-visit relative text, and a right-aligned contextual action
  ("Ask FitBot about {name}" — the one place the launcher pattern earns its
  keep by being contextual). 0-results state suggests "Ask FitBot" as
  fallback.

**Security/a11y guardrails (usability review — non-negotiable):**
- New endpoint (server action or `/api/staff/members`) calls
  `requireRoleOrThrow('staff')` + try/catch → 401 (unauth) / 403
  (wrong-role), mirroring `/api/chat/route.ts` EXACTLY. The RPC's
  `is_staff()` stays as defense-in-depth, not the only gate.
- Debounced (~300ms) AND cancelable search (abort in-flight on new input —
  stale-response race). No per-keystroke PII queries. Explicit submit is
  acceptable too.
- Results: `aria-live="polite"` announces COUNT only ("3 members found"),
  separate from the interactive result list (iter-4 split precedent);
  `aria-busy` during load; focus stays in input while typing.
- Generic error copy (reuse member-lookup's "couldn't look up members right
  now") — never leak raw Postgres/RPC error text.
- **PII in chat_messages**: retention/outreach presets from the console must
  be GENERIC templates ("draft outreach for a member who hasn't booked in
  30 days") — never auto-interpolate a real member's name/email into the
  message sent to `/api/chat` (which persists verbatim, indefinitely).
- No booking-history fan-out across a multi-result list (only on
  single-member drill-down, matching member-lookup.ts).
- Fill bars use badge token text+color pairs, never color-only, never solid
  teal/magenta fills with white text.
- Launcher tiles are `<button>`, focus moves into overlay on open, close
  returns focus to originating tile, no trap.
