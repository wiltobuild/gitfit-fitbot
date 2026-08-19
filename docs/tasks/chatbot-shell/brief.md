# Brief: Persistent chatbot shell (Phase 3)

## Scope

Add a persistent, corner-mounted chatbot overlay available on every
authenticated page, with conversation history that survives navigation —
backed by Supabase, not just component state. Reuses the existing stub
reply logic; no new intents (Phase 4's job).

- New Supabase table `chat_messages` (id, user_id, role, content,
  created_at), RLS: a user can only read/write their own rows.
- `/api/chat` extended to require auth (`requireUserOrThrow`), and to
  persist both the user's message and the assistant's reply to
  `chat_messages` instead of only returning a stub reply.
- New `GET` endpoint (or Server Action) to load the authenticated user's
  message history on mount.
- `app/components/chatbot-overlay.tsx` — client component: a collapsed
  floating button (bottom-right corner) that expands into a panel with
  message list + input, loading history on mount, sending through the
  now-persisting `/api/chat`.
- Mounted in `app/layout.tsx`, gated to authenticated users only (root
  layout becomes async, calls `getSession()`, conditionally renders the
  overlay after `{children}`).

## Out of scope

- The existing full-page `/chat` route (`app/chat/*`) — left as-is,
  unchanged, still a separate non-persistent stub experience. Not
  consolidated with the new overlay in this phase (a future decision, not
  blocking Phase 3's acceptance criteria).
- Any new intents/deterministic routing (Phase 4).
- Visual polish of the overlay beyond "presentable, on-brand, not broken"
  (Phase 12).

## Acceptance criteria

1. Signed-in user sees a collapsed chat affordance in the corner on any
   authenticated page (e.g. `/dashboard`); it is NOT present when signed
   out (verify via raw HTML response, same method as Phase 2).
2. Expanding it shows a message panel; sending a message persists both
   the user message and the assistant reply to `chat_messages` (verify via
   direct DB query).
3. Navigating to a different authenticated page and reopening the overlay
   shows the same conversation history (loaded from Supabase, not lost).
4. A user cannot see another user's chat history (RLS enforced — verify
   by querying as a different user).
5. `npm run lint` / `npm run build` pass.
6. `/`, `/chat`, `/appointments`, `/dashboard`, `/staff` all still work
   unchanged.

## Preflight state

Phases 1-2 complete and committed. `getSession()`,
`requireUserOrThrow()` available from `lib/auth/session.ts`. Existing
`/api/chat` is an unauthenticated stub with no persistence — this phase
adds auth + persistence to it. Existing `app/chat/chat-experience.tsx`
shows the UI pattern to draw from for the overlay's message list/input.
