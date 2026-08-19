# Brief: Deterministic intent router (Phase 4)

## Scope

Establish the intent-routing contract every future deterministic
capability (schedule, appointments, member lookup, time-off, retention —
Phases 5-10) and the eventual LLM fallback (Phase 11) plug into, per the
user's required flow: user request → intent detection → deterministic
tool/action if possible → LLM only when necessary → validated application
action → response.

- `lib/chatbot/types.ts` — `Intent` contract: `id`, `description` (for
  future introspection/help), `roles` (which roles can trigger it —
  `['client','staff']` or a subset), `match(message, session) => boolean
  | MatchResult`, `handle(message, session, match) => Promise<IntentResult>`.
  `IntentResult` = `{ reply: string; data?: unknown }` (the `data` field
  is for later phases to attach structured payloads — e.g. schedule
  results — that a richer UI can render instead of plain text; Phase 4
  doesn't need to use it yet, just define the shape).
- `lib/chatbot/router.ts` — `routeMessage(message, session): Promise<IntentResult & { intentId: string }>`. Iterates registered intents in
  order, respecting `roles`; on first match, calls `handle`; if none
  match, falls back to a `fallback` pseudo-intent (today: the existing
  deterministic stub reply text — Phase 11 replaces this specific branch
  with a real LLM call, nothing else in the router changes).
- `lib/chatbot/intents/index.ts` — the registry (an ordered array of
  `Intent` objects). Adding a new intent later = adding one object to this
  array, no router changes needed (this is the acceptance bar: "additional
  intents and tools can be added later without rewriting the chatbot").
- One real example intent to prove the mechanism end-to-end without
  scope creep into Phase 5+: `lib/chatbot/intents/help.ts` — a
  `help`/`what can you do`-style deterministic intent, keyword-matched,
  returning a role-aware capability list (different text for client vs.
  staff, reflecting what's actually built so far vs. honestly saying
  what's coming). This is a real, permanent capability, not throwaway.
- `/api/chat`'s `POST` handler calls `routeMessage()` instead of the
  hardcoded stub reply computation; persistence (Phase 3) unchanged —
  still persists the user message and whatever reply the router returns.

## Out of scope

- Any of the Phase 5-10 domain intents (schedule, appointments, member
  lookup, workout planning, time-off, retention) — those are separate
  phases, each adding entries to the registry this phase creates.
- LLM integration (Phase 11) — the fallback branch stays the existing
  deterministic stub text.
- Rendering `IntentResult.data` as rich UI (Phase 12 / whichever phase
  first produces structured data worth a custom component) — the overlay
  only needs to keep rendering `reply` as text for now.

## Acceptance criteria

1. `routeMessage()` correctly matches the `help` intent on relevant
   phrasing and returns a role-appropriate capability list; falls back to
   the existing stub reply for anything else (verify: existing Phase
   1-3 conversational behavior is unchanged for non-matching messages).
2. A client-role user triggering a staff-only intent's matcher (if
   `roles` excluded them) does NOT have it handled — verify by role-
   restricting the help intent's phrasing differently per role, or by
   reasoning about the roles-check path directly if no natural staff-only
   phrasing exists for `help` (acceptable to verify this via a temporary
   test intent removed before commit, or via code reading — document
   which).
3. Adding a new intent requires only appending to
   `lib/chatbot/intents/index.ts` — verify structurally (no router.ts
   change needed) rather than by actually adding a second intent in this
   phase.
4. `npm run lint` / `npm run build` pass.
5. Chat overlay (Phase 3) and `/chat` continue working — sending a
   message still gets a reply and persists, now via the router.

## Preflight state

Phases 1-3 complete and committed. `/api/chat`'s current reply computation
is a single hardcoded template string in `app/api/chat/route.ts` — this
phase extracts and generalizes it as the router's fallback, and adds the
`help` intent alongside it.
