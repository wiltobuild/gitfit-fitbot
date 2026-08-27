# Brief: FitBot time-off card, chip-list bug, and audio cues

Three independent fixes to the FitBot chat experience, bundled as one task
per the user's request.

## Scope

**A. Admin time-off card in chat** (`pending-time-off` chip / "show pending
time-off requests"): currently renders only a bare date + status badge per
request (`lib/chatbot/chips.ts`'s inline query selects only
`user_id, requested_date, status`; the `time-off` card type in
`lib/chatbot/types.ts` only carries `{date, status}`; `chat-cards.tsx`'s
renderer shows nothing else). Fix:
- Show the requester's real name.
- Show a profile picture — this app has no photo-upload field on members;
  reuse the existing `InstructorAvatar` component (real photo for the 6
  instructors who have one in `public/instructors/`, initials fallback for
  everyone else), the same avatar convention used everywhere else in the
  app.
- Show the reason, when one was given (`time_off_requests.reason` is a
  real column, already unused by this chip).
- Show an **accurate** list: the chip's own inline query duplicates (and
  is missing fields from) `lib/time-off/queries.ts`'s
  `listPendingTimeOffRequests`, which the admin dashboard and staff
  RequestsInbox already use correctly (with `id`, `reason`, and resolved
  `full_name`). Switch the chip to call that same function instead of
  maintaining a second, thinner, less complete copy of the same query.
- Add a **working** Approve button inside the chat card itself, calling
  the real, already-existing `/api/staff/time-off/resolve` endpoint
  (admin-only, takes `requestId` + `decision`). Note: this app already has
  one precedent for an in-chat-card action button
  (`OutreachCardActions`/"Send when ready") that is **decorative only** —
  it never calls a real endpoint. That is explicitly not the pattern to
  copy here; this button must perform a real mutation.

**B. Chip-list expand bug**: `chatbot-overlay.tsx`'s `visibleChips` caps
the chip list at `CHIP_PREVIEW_COUNT = 6` with a "Show N more" button.
Every role's chip menu (`CLIENT_MENU`/`STAFF_MENU`/`ADMIN_MENU` in
`lib/chatbot/chip-labels.ts`) ends with the `"menu"` chip itself ("What
can I ask?") as its last entry — since these lists are 10-11 items long,
`"menu"` only becomes visible once the list is expanded past the initial
6. The result: tapping "Show N more" reveals a "What can I ask?" chip
sitting inside the very answer to "what can I ask" — circular and
pointless. Fix: once the list is expanded, exclude the `"menu"` chip from
what's rendered (without breaking the "Show N more" count logic, which
must stay based on the real hidden count, not the post-filter count, or
the button will re-appear incorrectly).

**C. Audio cues**: no audio infrastructure exists anywhere in this app
today (confirmed: no audio files in `public/`, no `Audio`/`AudioContext`
usage anywhere). Add two short, distinct sounds — one on sending a
message, one on receiving FitBot's reply — synthesized via the Web Audio
API (no external audio asset files, no new dependency, fully
deterministic) rather than sourcing/embedding real audio files, since
none exist and this project has no asset-authoring pipeline. Applies to
both chat surfaces that send/receive messages: the floating overlay
(`chatbot-overlay.tsx`) and the full `/chat` page
(`chat-experience.tsx`).

## Out of scope

- Real photo uploads / a member photo field (no schema change — reuse the
  existing instructor-photo convention only).
- Deny button (only Approve was requested) — though the real endpoint
  supports both decisions, so this is a cheap follow-up later, not
  something to silently add now.
- Fixing `OutreachCardActions`' own decorative-only behavior — out of
  scope, only called out as a pattern *not* to copy.
- Any other chat card types (members, workout, booking, capacity, etc.) —
  only the `time-off` card changes.
- User-configurable audio (mute toggle, volume) — just the two cues
  playing on their trigger events; a mute control isn't requested here.

## Acceptance criteria

1. The pending-time-off chat card shows, per request: requester name, an
   avatar (real photo if available, initials otherwise), the reason (when
   present), and the request date.
2. The list of requests shown matches exactly what
   `listPendingTimeOffRequests` returns (same source of truth as the
   admin dashboard/staff inbox) — no separate, thinner query.
3. Each pending request has a real Approve button that calls
   `/api/staff/time-off/resolve` with that request's real `id` and
   `decision: "approved"`, shows a pending/loading state, and reflects
   the outcome (success or error) without requiring a page reload.
4. In the chatbot overlay, once the chip list is expanded past the
   initial 6, the "What can I ask?" (`menu`) chip no longer appears in
   the rendered list, and the "Show N more" button's count/visibility
   logic is unaffected by this exclusion (it still correctly disappears
   once genuinely fully expanded).
5. A short, distinct sound plays when a message is sent, and a different
   short, distinct sound plays when FitBot's reply arrives, in both the
   floating overlay and the full `/chat` page.
6. `npx tsc --noEmit`, `npm run lint`, `npm test` all clean.
7. Verified live in the browser as an admin: real request data with a
   working approve action; as a client/staff: chip expand behavior and
   audible send/receive cues.

## Preflight state

- Branch: `main`, up to date with `origin/main`.
- Relevant files: `lib/chatbot/chips.ts` (`pending-time-off` handler),
  `lib/chatbot/types.ts` (`RichCard` "time-off" variant),
  `app/components/chat-cards.tsx` (card renderer + `OutreachCardActions`
  precedent), `lib/time-off/queries.ts` (`listPendingTimeOffRequests`,
  already correct and reused elsewhere), `app/api/staff/time-off/resolve/route.ts`
  (real, working, admin-only, already used by the staff console),
  `app/components/instructor-avatar.tsx` (avatar convention to reuse),
  `app/components/chatbot-overlay.tsx` (chip cap/expand logic + both
  `sendMessage`/`sendChip` handlers), `app/chat/chat-experience.tsx`
  (second chat surface, same send/receive events, no chip cap/expand
  logic of its own).
