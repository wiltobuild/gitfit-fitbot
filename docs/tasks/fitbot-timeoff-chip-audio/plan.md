# Plan: FitBot time-off card, chip-list bug, and audio cues

Grounded in `brief.md` and `investigation.md` (Argus). Every decision below
cites the actual current code read directly during planning
(`lib/chatbot/chips.ts`, `lib/chatbot/types.ts`, `app/components/chat-cards.tsx`,
`app/components/outreach-card-actions.tsx`, `lib/time-off/queries.ts`,
`app/api/staff/time-off/resolve/route.ts`, `app/components/instructor-avatar.tsx`,
`app/staff/requests-inbox.tsx`, `lib/chatbot/chip-labels.ts`,
`app/components/chatbot-overlay.tsx`, `app/chat/chat-experience.tsx`,
`app/globals.css`).

---

## Decision: Time-off card data source

### Evidence
`chips.ts:17`'s `pending-time-off` handler runs its own inline query
(`.select("user_id, requested_date, status")`, then a second `profiles`
query) — no `id`, no `reason`. `lib/time-off/queries.ts`'s
`listPendingTimeOffRequests` already does the equivalent two-query join
correctly and completely: `{ id, requested_date, reason, created_at,
full_name }`, filtered to `status = "pending"` server-side. It has **no
`status` field** because every row is definitionally pending (Argus
confirmed). `app/dashboard/page.tsx` and this function's own module are the
only other callers — no shape mismatch risk from switching.

### Options
1. Switch the chip handler to call `listPendingTimeOffRequests(supabase)`
   directly, deleting its inline query and second profiles lookup.
2. Keep the inline query but add `id`/`reason` to its `select(...)`.

### Recommendation
Option 1.

### Why
Option 2 perpetuates a second, hand-maintained copy of the exact same
join `listPendingTimeOffRequests` already gets right (this duplication is
literally what produced today's bug — the brief is explicit that this is
the point of the fix). Option 1 also deletes code (the second `profiles`
query in `chips.ts`) instead of adding to it. The chip handler's status
gate (`adminOnly`) and reply-text formatting are unaffected — only the
data-fetch and card-building lines change signature. The card will drop
the status badge entirely (see next decision) since `listPendingTimeOffRequests`
has nothing to badge with.

### Approval requested
Confirm: chip handler switches to `listPendingTimeOffRequests`; the
per-row status badge is removed from the card (every row shown is
definitionally pending, so a badge reading "pending" on every row adds no
information).

---

## Decision: `RichCard` "time-off" shape

### Evidence
Current shape (`lib/chatbot/types.ts:33-39`): `{ kind: "time-off";
requests: Array<{ date: string; status: "pending"|"approved"|"denied" }>
}`. `listPendingTimeOffRequests` returns `{ id, requested_date, reason,
created_at, full_name }`. The existing `"members"` variant
(`types.ts:18-27`) already uses a UI-facing `name`/`reason` shape decoupled
from the DB column names (`name`, not `full_name`) — the established
convention in this file is to normalize field names for the card, not
pass raw DB rows through.

### Options
1. New shape: `{ kind: "time-off"; requests: Array<{ id: string; name:
   string; reason: string | null; date: string }> }` — chip handler maps
   `full_name ?? "Staff member"` into `name` (matching the existing plain-text
   reply's fallback string) and `requested_date` into `date`.
2. Pass `PendingTimeOffRequest` through almost as-is (`full_name`,
   `requested_date` field names retained in the card type).

### Recommendation
Option 1.

### Why
Matches the existing `"members"` card's normalized-field convention
(`name`/`reason`, not raw column names) rather than leaking
`lib/time-off/queries.ts`'s internal shape into the UI layer. Baking the
`"Staff member"` null-name fallback into the mapping (chips.ts, at build
time) means the card component, `InstructorAvatar`, and initials all
automatically get a sane string — no separate null-handling branch needed
in the renderer. `id` is required (previously absent) so the Approve
action has something to send to the resolve endpoint.

For the Approve outcome: mirror `app/staff/requests-inbox.tsx`'s actual
behavior — `resolve()` does `setRequests(current => current.filter(r =>
r.id !== id))` on success, i.e. **the row disappears from the list**, not
"replaced with an Approved badge." This is a real precedent already
proven in this codebase (vs. inventing new UX). It also directly satisfies
brief acceptance criterion 3 ("reflects the outcome ... without requiring
a page reload") and the acceptance test in this plan's "done" section
("a follow-up ask no longer includes it" — consistent with the row being
gone from the card's own list the moment it's approved, not just visually
badged while still occupying the list).

### Approval requested
Confirm the new shape (`id`, `name`, `reason`, `date`) and confirm
"approve removes the row from the card's own list" (RequestsInbox
pattern) over "leave the row visible with an Approved badge."

---

## Decision: New client component boundary

### Evidence
`OutreachCardActions` (`app/components/outreach-card-actions.tsx`) is the
one existing precedent for "a chip-list card embeds a stateful action":
own file, own `"use client"`, holds a single boolean (`queued`) for one
outreach subject. But it only renders the *action* — `chat-cards.tsx`'s
switch case still owns the surrounding markup and the `card.members`-style
list iteration for other cards. Time-off is a **list** of independently
resolvable rows (approving row 3 must remove only row 3, not affect
rows 1/2), which needs the *array itself* to live in local state
somewhere — exactly the shape `app/staff/requests-inbox.tsx`'s
`RequestsInbox` already solves (`useState(initialRequests)`, filters the
approved id out on success). `chat-cards.tsx` itself is a stateless
function component today (no hooks) and has no `"use client"` of its own
(it inherits client-bundling from its two callers).

### Options
1. New file `app/components/time-off-requests-card.tsx` ("use client"),
   which owns the whole list: takes `requests: TimeOffCard["requests"]` as
   a prop, holds `useState` for the local (mutable) copy, renders each row
   (avatar + name + reason + date + Approve button), calls the resolve
   endpoint, and filters the approved row out of its own state on success.
   `chat-cards.tsx`'s `case "time-off"` becomes a one-line delegate:
   `return <TimeOffRequestsCard requests={card.requests} />;`
2. Strictly clone `OutreachCardActions`': a `TimeOffCardActions` component
   that is only the per-row button + pending state, taking an
   `onResolved(id)` callback — but then something above it still has to
   own the mutable array, and `chat-cards.tsx` has no state today, so this
   would mean either lifting the array into `chat-cards.tsx` (breaking its
   current stateless-function convention) or into the page-level
   `messages` state in both `chatbot-overlay.tsx` and `chat-experience.tsx`
   (duplicating the same list-mutation logic in two places).

### Recommendation
Option 1.

### Why
Option 2 either breaks an existing convention (`chat-cards.tsx` staying
stateless) or duplicates list-removal logic across both chat surfaces.
Option 1 keeps the file-per-card-action convention `OutreachCardActions`
established (own file, own `"use client"`, one clear responsibility) while
adapting it to what a *list* of independently-resolvable actions actually
requires — which is precisely what `RequestsInbox` already does today,
successfully, for the same data. `chat-cards.tsx`'s switch statement stays
uniformly thin (a `case` per kind that either renders directly or delegates
to a named sub-component), consistent with the `"outreach"` case's existing
delegation pattern.

### Approval requested
Confirm creating `app/components/time-off-requests-card.tsx` as a
list-owning component (mirroring `RequestsInbox`'s state pattern, not a
literal `OutreachCardActions` clone) is the right boundary.

---

## Decision: Avatar lookup

### Evidence
`InstructorAvatar` (`app/components/instructor-avatar.tsx`) takes `{ name,
size, loading? }`; `hasPhoto` is a lowercase-name Set lookup, non-matches
render initials via a local `initials(name)` helper. No schema/photo
field exists or is needed. `chat-cards.tsx`'s own `initials()` helper
(line 7) is identical logic, already used for the `"members"` case.

### Options
1. Pass the mapped `name` field (see previous decision — already includes
   the `"Staff member"` null fallback) straight into `InstructorAvatar`,
   exactly like the `"schedule"` card already does for instructors
   (`chat-cards.tsx:17`).

### Recommendation
Option 1 (no real alternative — this is the established, working
convention for every other avatar in this app).

### Why
None of the ~294 non-instructor members/staff are in `instructorPhotoNames`,
so they all correctly fall through to initials — exactly the brief's
intent ("initials fallback for everyone else"). Baking `"Staff member"`
into the `name` field at the chips.ts mapping step (previous decision)
means `InstructorAvatar` never receives `null`/empty string — its initials
helper turns `"Staff member"` into `"SM"`, a reasonable, non-broken
fallback for a request from a profile with no `full_name` set.

### Approval requested
None — this follows directly from the "time-off" shape decision above
with no material alternative.

---

## Decision: Menu-chip fix mechanics

### Evidence
`chatbot-overlay.tsx:26-31`:
```js
const CHIP_PREVIEW_COUNT = 6;
const visibleChips = chipsExpanded ? suggestedChips : suggestedChips.slice(0, CHIP_PREVIEW_COUNT);
const hiddenChipCount = suggestedChips.length - visibleChips.length;
```
Argus confirmed `ADMIN_MENU` places `"menu"` second-to-last (index 9 of
11), not strictly last, but since `CHIP_PREVIEW_COUNT = 6` and all three
menus are 10-11 items, `"menu"` is always beyond the initial cap for every
role — it only ever becomes visible once `chipsExpanded` is true. The
greeting chip set (`["quick-workout","plan-my-week","menu"]`, only 3 items)
is a case where `"menu"` **is** within `visibleChips` while
`chipsExpanded` is false — filtering `"menu"` unconditionally from every
render would remove FitBot's only inline "what can I ask" entry point for
that state (the standalone `☰` button in the form remains, but that's a
separate affordance, not a reason to also silently break the inline chip).

### Options
1. Filter only the array actually rendered, only while expanded, leaving
   `hiddenChipCount`'s inputs (`suggestedChips`, `visibleChips`) untouched:
   ```js
   const visibleChips = chipsExpanded ? suggestedChips : suggestedChips.slice(0, CHIP_PREVIEW_COUNT);
   const hiddenChipCount = suggestedChips.length - visibleChips.length; // unchanged
   const renderedChips = visibleChips.filter((chipId) => !chipsExpanded || chipId !== "menu");
   ```
   then render `renderedChips.map(...)` instead of `visibleChips.map(...)`.
2. Filter `"menu"` unconditionally from every render (expanded or not).

### Recommendation
Option 1.

### Why
Option 2 would also strip `"menu"` from the 3-item greeting chip row,
where it isn't hidden-then-revealed (it's just directly visible) and isn't
redundant — the brief's complaint is specifically about the *expanded*
list containing a chip whose entire purpose was "show me what's hidden,"
which is circular only once the list has actually been expanded past the
cap. `hiddenChipCount`'s calculation is left completely untouched (it
still reads off `suggestedChips.length - visibleChips.length` before any
menu-filtering), satisfying the brief's explicit constraint that the
"Show N more" count must track the real hidden count, not the post-filter
one. This applies regardless of *how* the list got expanded (there's only
one way today — the "Show N more" button — so "universally" and
"whenever triggered by that button" are currently the same thing; the
`chipsExpanded` condition makes the fix correct even if a second expansion
trigger is ever added later).

**Scope note:** this only touches `chatbot-overlay.tsx`. `chat-experience.tsx`
has no cap/expand logic at all (Argus confirmed — it renders
`suggestedChips` in full, unsliced) and is not mentioned in the brief's
acceptance criterion 4, which is scoped to "the chatbot overlay." No
change to `chat-experience.tsx` for this bug.

### Approval requested
Confirm the `chipsExpanded &&`-guarded filter (Option 1) and confirm the
fix is scoped to `chatbot-overlay.tsx` only.

---

## Decision: Audio cue design

### Evidence
Confirmed zero existing audio infrastructure anywhere in the repo (no
files in `public/`, no `AudioContext`/`Audio` usage, no audio dependency
in `package.json`). Trigger call sites (both confirmed gesture-chained —
form `onSubmit` / button `onClick` — so no autoplay-policy workaround is
needed):
- `chatbot-overlay.tsx`: `sendMessage` user-append (line 43, right after
  the `isSending` guard) → **send** cue; the `setMessages` call inside
  `runWithTypingFloor` that appends the assistant reply (same line 43) →
  **receive** cue. `sendChip` (line 44): identical two points.
- `chat-experience.tsx`: `sendMessage` (line 23) user-append → **send**
  cue; both branches of `interpretChatResponse`'s outcome (`"reply"` and
  the else/error branch) → **receive** cue, since both represent "FitBot
  responded" from the user's perspective. `sendChip` (line 24): same two
  points as the overlay's version.

### Options for tone design
1. **Send**: single soft sine-wave blip, ~880 Hz, ~80 ms, quick linear
   attack (~5 ms) then exponential decay to silence, low gain (~0.06).
   **Receive**: two-note gentle ascending chime, ~523 Hz → 659 Hz (roughly
   C5 → E5), ~140 ms total, same low gain, exponential decay on each note.
   Distinct in both pitch contour (flat single tone vs. rising two-note)
   and duration, short enough to not feel intrusive on every message.
2. Louder/longer "notification"-style tones (more like a phone ping).

### Recommendation
Option 1.

### Why
Brief explicitly asks for "short, distinct... non-annoying" cues that
play on *every* message — a longer/louder tone (Option 2) would become
grating quickly at chat-message frequency. A flat single blip vs. a
rising two-note interval is easily distinguishable without needing to be
loud, and both are near-instantaneous so they don't add perceptible delay
to the chat's already-tuned `TYPING_MIN_VISIBLE_MS` pacing.

### Module boundary
New shared module `lib/chat/notification-sounds.ts`, exporting
`playSendSound()` and `playReceiveSound()`. Internals: a module-level
lazily-created `AudioContext` singleton (created on first call, not at
module load, since constructing one before any user gesture can be
silently blocked by autoplay policy — Argus flagged this as the one minor
unknown; lazy creation at first-call time, when all current call sites are
gesture-chained, sidesteps it) built with `OscillatorNode` + `GainNode`
per tone, wrapped in `try { ... } catch { /* ignore */ }` so any audio
failure (blocked context, unsupported browser) never breaks the chat flow.
Imported by both `chatbot-overlay.tsx` and `chat-experience.tsx` — no
duplication of synthesis code across the two files.

### Approval requested
Confirm the two tone designs (frequencies/durations/waveform above) and
the new module path (`lib/chat/notification-sounds.ts`); confirm receive-cue
fires on both branches of `chat-experience.tsx`'s `interpretChatResponse`
outcome (reply and error), not just the `"reply"` branch.

---

## Decision: Scope boundary confirmation

### Evidence
- `time_off_requests.reason` and `.id` already exist as real columns
  (used today by `listPendingTimeOffRequests`) — no migration needed.
- Web Audio API (`AudioContext`, `OscillatorNode`, `GainNode`) is a
  browser built-in — no new npm dependency.
- `.chat-member-row`/`.chat-members-card` (`app/globals.css:494`) already
  render avatar + name + `<small>` reason line for the `"members"` card —
  the exact layout the time-off card needs (avatar, name, reason, date).
  The one thing genuinely missing is button sizing inside a
  `chat-member-row` — `.chat-outreach-card .btn { min-height:34px;
  padding-inline:11px; font-size:11px; }` (`globals.css:496`) is the
  existing precedent for sizing a `.btn` inside a chat card.

### Recommendation
- No schema/migration changes.
- No new npm dependency.
- Small, additive CSS only: give the time-off card's `<section>` an extra
  class (e.g. `chat-time-off-card`, alongside the existing
  `chat-members-card`) and add one small rule sized like the outreach
  card's button override, e.g.:
  ```css
  .chat-time-off-card .btn { min-height:30px; padding-inline:10px; font-size:11px; flex:0 0 auto; }
  ```
  No new visual language — reuses `.chat-member-row`, `.badge`-free (badge
  is being removed per the first decision), and the existing `.btn
  .btn-success .btn-sm` classes already used by `RequestsInbox`'s own
  Approve button.

### Why
Matches the brief's explicit "Out of scope" list (no photo uploads, no
schema change) and Argus's confirmation that all needed columns/behavior
already exist; the CSS addition is the minimum needed to fit a button into
a row style that otherwise already supports everything else the card
needs.

### Approval requested
Confirm the small CSS addition (new `chat-time-off-card` class + one
button-sizing rule) rather than reusing `chat-outreach-card` outright
(which carries outreach-specific message/dashed-border styling this card
doesn't want).

---

## Phased implementation plan

Each phase is independently reviewable and reversible.

**Phase 1 — Time-off card data + types (server-side and type layer only)**
- `lib/chatbot/chips.ts`: replace the `pending-time-off` handler's inline
  query + second `profiles` query with a call to
  `listPendingTimeOffRequests(supabase)`; update the plain-text `reply`
  formatting to use each request's `full_name ?? "Staff member"` directly
  (no separate `nameByUser` map needed); build the card as
  `{ kind: "time-off", requests: pending.map(r => ({ id: r.id, name: r.full_name ?? "Staff member", reason: r.reason, date: r.requested_date })) }`.
- `lib/chatbot/types.ts`: change the `"time-off"` `RichCard` variant to
  `{ kind: "time-off"; requests: Array<{ id: string; name: string; reason: string | null; date: string }> }`.
- No UI change yet — `chat-cards.tsx`'s existing case will now read stale
  field names and needs Phase 2 to compile; land Phases 1+2 together in
  one PR-sized change (they're too tightly coupled by the type change to
  usefully split further), but keep them as clearly separate diff hunks
  for review.

**Phase 2 — Time-off card UI + Approve action**
- New file `app/components/time-off-requests-card.tsx` ("use client"):
  `TimeOffRequestsCard({ requests })`, local `useState(requests)`, per-row
  `pendingId`/`error` state (mirroring `RequestsInbox`), a `resolve(id)`
  function that `fetch`es `/api/staff/time-off/resolve` with
  `{ requestId: id, decision: "approved" }`, removes the row from local
  state on success, surfaces an error message on failure. Renders each row
  with `InstructorAvatar` (`name={request.name}` size 32, matching the
  schedule card's instructor-avatar sizing), name, reason (`<small>` if
  present), formatted date, and an Approve button (disabled + "…" label
  while pending, matching `RequestsInbox`'s exact UX).
- `app/components/chat-cards.tsx`: `case "time-off"` becomes
  `return <TimeOffRequestsCard requests={card.requests} />;` (delete the
  old inline badge-rendering code for this case).
- `app/globals.css`: add `chat-time-off-card` class + button-sizing rule
  (see Scope decision).

**Phase 3 — Chip-list menu fix**
- `app/components/chatbot-overlay.tsx`: add `renderedChips` (filtered,
  post-`hiddenChipCount` calculation, guarded by `chipsExpanded`) and swap
  the chip-buttons `.map` to use it instead of `visibleChips`. No other
  logic changes.

**Phase 4 — Audio cues**
- New file `lib/chat/notification-sounds.ts`: `playSendSound()`,
  `playReceiveSound()`, lazy `AudioContext` singleton, try/catch-wrapped.
- `app/components/chatbot-overlay.tsx`: import and call `playSendSound()`
  at both user-message-append points (`sendMessage`, `sendChip`);
  `playReceiveSound()` at both assistant-message-append points.
- `app/chat/chat-experience.tsx`: same four call sites, with
  `playReceiveSound()` firing on both branches of `sendMessage`'s
  `interpretChatResponse` outcome.

**Phase 5 — Verification pass**
- `npx tsc --noEmit`, `npm run lint`, `npm test`.
- Live browser check (see acceptance criteria below).

---

## What "done" and "verified" mean

Mechanically/visually checkable by a later verifier (Apollo):

1. **Type/lint/build clean**: `npx tsc --noEmit`, `npm run lint`, `npm test`
   all exit 0 with no new errors/warnings attributable to these changes.
2. **Time-off card content** (sign in as admin, ask FitBot "show pending
   time-off requests" or tap the `pending-time-off` chip):
   - Card shows, per pending request: a real name (or "Staff member" if
     the profile has no `full_name`), an avatar (real photo if the name
     matches one of the 6 instructor photo names, initials otherwise), the
     reason text when the DB row has one (nothing shown when `reason` is
     `null`), and a formatted date. No status badge is shown anywhere on
     the card.
   - The set of requests shown exactly matches what a direct call to
     `listPendingTimeOffRequests` returns for the same DB state (same
     count, same requester names, same dates) — no request present in one
     but missing from the other.
3. **Approve action** (same admin session, same card):
   - Clicking "Approve" on one row disables that row's button and shows a
     loading state (mirroring `RequestsInbox`'s "…" label) without
     affecting other rows' buttons.
   - On success: a real `POST /api/staff/time-off/resolve` request was
     sent with that row's real `id` and `decision: "approved"` (checkable
     via network tab); the row disappears from the card with no page
     reload; the underlying DB row's `status` becomes `"approved"`.
   - Re-asking "show pending time-off requests" afterward (new chip/message,
     not just re-rendering the old card) no longer includes the
     just-approved request.
   - Simulate/observe a failure (e.g. resolving an already-resolved id) and
     confirm an error is surfaced on that row without crashing the card or
     removing the row.
4. **Chip-list expand fix** (any role with a chip menu longer than 6 —
   e.g. admin or staff, in the floating overlay):
   - Initially only the first 6 chips + a "Show N more" button are visible;
     "menu" ("What can I ask?") is not among them (it's beyond index 6 for
     every role).
   - After tapping "Show N more": the full remaining set renders **except**
     the "menu" chip is absent from the rendered list; the "Show N more"
     button itself is gone (fully expanded, no further hidden count).
   - The greeting state (3 chips including "menu", never expanded) still
     shows "menu" inline — confirming the fix didn't remove it from
     short/unexpanded lists.
   - `chat-experience.tsx`'s always-full chip row is unchanged (still shows
     "menu" inline, since that surface was out of scope for this bug).
5. **Audio cues** (any role, either chat surface — floating overlay and
   `/chat` page):
   - Sending a message (via typed message or tapping a chip) plays one
     short tone immediately on send.
   - A distinguishably different short tone plays when FitBot's reply
     lands (including on an error/failure reply in `chat-experience.tsx`).
   - No console errors/exceptions from the audio code (e.g. in a browser
     where autoplay is blocked, the chat still functions normally with no
     visible/functional degradation, just silently no sound).
6. **No regressions to out-of-scope areas**: `OutreachCardActions` remains
   unchanged (still decorative-only, not a target of this task); no Deny
   button added anywhere; no other `RichCard` kind's rendering changed; no
   mute/volume control added.
