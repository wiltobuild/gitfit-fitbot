# Investigation: FitBot time-off card, chip-list bug, audio cues

Read-only ground-truth pass. No code changed.

## 1. Time-off card, current state

**Chip handler — `lib/chatbot/chips.ts:17`** (`pending-time-off`, single line, one giant statement):
- Gate: `adminOnly(session)` (chips.ts:7) — only `session.role === "admin"` passes.
- Runs its own inline query: `.from("time_off_requests").select("user_id, requested_date, status").eq("status", "pending").order("requested_date")` — does **not** select `id` or `reason`.
- Fetches names via a second query on `profiles` keyed by `user_id` — this part duplicates the logic in `listPendingTimeOffRequests` almost exactly (same two-query shape, same comment reasoning about `auth.users` not being exposed).
- Builds `card: { kind: "time-off", requests: pending.map(request => ({ date: request.requested_date, status: request.status })) }` — no `id`, no `reason`, no name, no avatar reference at all in the card payload (name is only used in the plain-text `reply` string, not the card).

**`RichCard` union — `lib/chatbot/types.ts:5-78`:**
- `"time-off"` variant (line 33-39): `{ kind: "time-off"; requests: Array<{ date: string; status: "pending" | "approved" | "denied" }> }` — confirmed thin, exactly as brief states.
- Other variants for comparison: `"members"` (line 18-27) carries `name/email/status/reason?`; `"outreach"` (line 40-46) carries `memberName/message/sent/sentAt?`; `"disambiguation"` (line 68-72) carries `options: Array<{label, detail?, sendMessage}>` and is the only variant whose renderer takes a callback (`onSelectOption`) already wired through both chat surfaces (see below) — this is the closest existing precedent for "card needs to call back into page-level state," though it calls `sendMessage` with a canned string rather than hitting an API route directly.

**`app/components/chat-cards.tsx`** (full file read, 33 lines):
- No `"use client"` directive of its own (chat-cards.tsx:1-3, confirmed by explicit `head -3` check).
- `case "time-off"` (chat-cards.tsx:25): renders only `formatDate(request.date)` and a status badge. No name, no avatar, no reason, no id used anywhere (there's no id to use).
- `case "outreach"` (chat-cards.tsx:26): renders `<OutreachCardActions sent={card.sent} sentAt={card.sentAt} />`.
- **`OutreachCardActions` (`app/components/outreach-card-actions.tsx`, full file, 27 lines) is confirmed decorative-only**: `"use client"` (line 1), local `useState` `queued` (line 8), `queueOutreach()` (lines 12-15) only does `setQueued(true)` and `showSuccess("Outreach queued to send")` (a toast) — **no `fetch`, no import of any API client, nothing that touches the network at all**. This is the exact proof the brief asked for: it is UI-only optimism with zero backend effect.

**`lib/time-off/queries.ts`** (full file, 64 lines):
- `PendingTimeOffRequest` type (lines 5-11): `{ id: string; requested_date: string; reason: string | null; created_at: string; full_name: string | null }`. Note: **no `status` field** — every row this function returns is implicitly `status: "pending"` because of the `.eq("status", "pending")` filter (line 20), so a time-off chat card built from this function has no per-row status to badge (every row is pending by construction — the badge in the current `time-off` card is redundant once this switch happens, since it will always read "pending").
- `listPendingTimeOffRequests` (lines 16-44): selects `id, user_id, requested_date, reason, created_at`, joins to `profiles.full_name` the same two-query way, returns the array above. This is the accurate source of truth per the brief.
- `getPendingTimeOffCount` (46-53) and `submitTimeOffRequest` (57-63) also live here, not directly relevant to this task.

**`app/api/staff/time-off/resolve/route.ts`** (full file, 32 lines) — exact contract:
- `POST` only.
- Auth: `requireRoleOrThrow("admin")` (line 12) — throws `UnauthorizedError` with `.reason` of `"unauthenticated"` or (implicitly) any other value for "wrong role"; route maps `"unauthenticated"` → 401 `{error:{message:"Unauthorized"}}`, anything else → 403 `{error:{message:"Forbidden"}}` (lines 13-18).
- Body: JSON, parsed with `.catch(() => null)` so a bad/missing body never throws; needs `requestId: string` (trimmed, non-empty) and `decision` that is literally `"approved"` or `"denied"` (lines 20-22). Missing/invalid either → 400 `{error:{message:'A requestId and a decision of "approved" or "denied" are required.'}}` (line 24).
- On valid input: calls `resolveTimeOffRequest(supabase, {requestId, decision, reviewerId: session.user.id})` (line 28).
- Success: 200 `{ ok: true }` (line 29). Failure (e.g., request already resolved or doesn't exist): 404 with `{error:{message: result.message}}` (line 30) where `result.message` is `"That request is no longer pending, or does not exist."` (from `lib/staff/time-off.ts:23`).
- `lib/staff/time-off.ts:7-26` (`resolveTimeOffRequest`, full file read): updates `time_off_requests` setting `status`, `reviewed_by`, `reviewed_at`, guarded by `.eq("id", requestId).eq("status","pending")`; comment at lines 11-13 explicitly notes RLS's `time_off_requests_update_admin` policy is the real security boundary and the `.eq("status","pending")` here is only an app-level anti-double-resolve guard, not the auth gate.

**`app/components/instructor-avatar.tsx`** (full file, 19 lines):
- `InstructorAvatarProps = { name: string; size: 32 | 40 | 64; loading?: "eager"|"lazy" }` — size is a closed union, not an arbitrary number.
- `instructorPhotoNames` (line 5) is a hardcoded `Set` of exactly 6 lowercased instructor names (sofia martinez, marcus lee, avery thompson, diego reyes, elena cruz, jordan blake) — confirmed these 6 `.jpg` files exist in `public/instructors/` (verified via directory listing, exact filenames match the slugified names).
- Any `name` not in that set renders initials only (line 17) — so passing a time-off requester's name straight into `InstructorAvatar` works exactly as the brief wants (initials fallback for the ~294 non-instructor members/staff), no schema change needed.

**Established real precedent for this exact data — `app/staff/requests-inbox.tsx`** (full file, 89 lines), the actual working Approve/Deny UI already wired to this same endpoint:
- `PendingRequest` type (lines 5-10) mirrors `listPendingTimeOffRequests`'s shape but with `requester_name` instead of `full_name` (this component clearly consumes a mapped/renamed version of `PendingTimeOffRequest`, not the raw type — a planner should note the field-name mismatch, `full_name` vs `requester_name`, when deciding whether to reuse this shape or `PendingTimeOffRequest` as-is for the card).
- `resolve(id, decision)` (lines 32-49): `setPendingId(id)` for a per-row loading state, `fetch("/api/staff/time-off/resolve", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({requestId: id, decision})})`, parses `{error?:{message?}}` on non-ok and throws that message, on success does `setRequests(current => current.filter(r => r.id !== id))` (optimistic local removal, no page reload/router.refresh), sets `error` state and clears `pendingId` in `finally`.
- Approve/Deny buttons (lines 74-81) disable while `isPending` and show `"…"` as loading text.
- This is the concrete, working pattern to mirror for the new in-chat Approve button — not `OutreachCardActions`.
- Where `PendingRequest`/`RequestsInbox` gets its data (i.e., the server page that calls `listPendingTimeOffRequests` and passes `initialRequests`) was not directly located by name search of "RequestsInbox" as a call site in this pass — grepping `listPendingTimeOffRequests` usage shows matches in `app/dashboard/page.tsx` and `lib/time-off/queries.ts` itself (plus a prior task's plan doc); the staff page that renders `RequestsInbox` presumably lives under `app/staff/` and maps `PendingTimeOffRequest` → `PendingRequest`, but the exact mapping call site (full_name → requester_name) was not opened in this pass — **unknown, flag for planner**: locate that mapping if the chat card is meant to reuse `PendingRequest`'s exact prop shape rather than defining its own.

## 2. Chip-list bug, current state

**`app/components/chatbot-overlay.tsx`** (full file, 47 lines):
- `CHIP_PREVIEW_COUNT = 6` (line 26).
- `visibleChips = chipsExpanded ? suggestedChips : suggestedChips.slice(0, CHIP_PREVIEW_COUNT)` (line 30).
- `hiddenChipCount = suggestedChips.length - visibleChips.length` (line 31) — computed from the **pre-filter** `suggestedChips`/`visibleChips` pair, so any post-slice filtering done later must not touch this line's inputs or the "Show N more" count will silently drift from the truly-hidden count.
- Chip buttons rendered at line 46: `{visibleChips.map(chipId => <button ...>{CHIP_LABELS[chipId]}...)}{hiddenChipCount > 0 ? <button ... onClick={() => setExpandedChipsKey(chipsKey)}>Show {hiddenChipCount} more</button> : null}`.
- **`menu` chip is also directly reachable another way in this component**: a standalone `☰` button in the message form itself (line 46, `<button className="chat-menu-button" ... onClick={() => void sendChip("menu")}>`) — independent of the chip list, always visible regardless of expand state. Worth the planner knowing this exists as an existing "ask what can I ask" affordance alongside the chip itself.

**`lib/chatbot/chip-labels.ts`** (full file, 17 lines) — exact contents:
- `CLIENT_MENU` (line 15): 11 items, ends with `"menu"` at index 10 (last).
- `STAFF_MENU` (line 16): 10 items, ends with `"menu"` at index 9 (last).
- `ADMIN_MENU` (line 17): `[...STAFF_MENU, "pending-time-off"]` — **11 items, and `"menu"` is at index 9, NOT last; `"pending-time-off"` is appended after it and is the actual last item (index 10).**
- **This partially contradicts the brief's framing** ("every role's chip menu... ends with the `menu` chip itself"): true for `CLIENT_MENU` and `STAFF_MENU`, **false for `ADMIN_MENU`** — for admin, `menu` sits second-to-last, not last. It is still only reachable past the `CHIP_PREVIEW_COUNT = 6` cutoff for all three lists (index 9 or 10 is always ≥ 6), so the described bug (menu chip appears once expanded) still reproduces for every role including admin; the fix (exclude `"menu"` from the *expanded, rendered* list without changing the hidden-count math) is unaffected by this correction, but a planner should not assume "menu is always the literal last element" if that assumption were to matter for some other logic.
- `CHIP_ROLES["menu"] = ["client","staff","admin"]` (chip-labels.ts:12) — visible to all roles, consistent with it appearing in all three menu arrays.

**`app/chat/chat-experience.tsx`** (full file, 27 lines): confirmed **no** cap/expand logic — `suggestedChips` (line 22) is rendered in full and directly: `<div className="chat-starters">{suggestedChips.map(chipId => <button ...>)}</div>` (line 25), no slicing, no `CHIP_PREVIEW_COUNT`, no "Show more" button, no local `expandedChipsKey`-equivalent state anywhere in the file. Brief's assumption confirmed correct for this surface. This means the chip-list bug (B) is scoped only to `chatbot-overlay.tsx`; `chat-experience.tsx` already shows the full unfiltered `suggestedChips` array (including `menu`) but was never described as buggy in the brief because there's no truncation to make the recursion visible/obviously wrong — worth flagging that `chat-experience.tsx` will also render `menu` inline (not "hidden then oddly revealed," just present in the flat list) if a fully consistent fix means excluding `menu`-once-in-list everywhere, though the brief's acceptance criteria (item 4) only mentions the overlay's expand behavior.

## 3. Audio, current state

Confirmed via grep across `app/` and `lib/` and a `public/` directory listing:
- No audio files anywhere in `public/` — contents are `appointments-prototype.html`, `gitfit-icon.gif`, `gitfit-lockup.gif`, and `instructors/` (6 `.jpg` files only).
- Zero matches for `AudioContext`, `new Audio(`, or `playSound` anywhere under `app/` or `lib/` (case-insensitive grep, zero hits).
- Zero audio-related dependency in `package.json` (grep for `audio|sound|howler|tone`, zero hits).

**Exact trigger call sites, both surfaces** (need a send-cue on optimistic append, a receive-cue when the assistant reply lands):

`app/components/chatbot-overlay.tsx`:
- `sendMessage` (line 43): user-message optimistic append is `setMessages((current) => [...current, { role: "user", content: message }])` — immediately after the `if (!message || isSending) return` guard, itself inside the `<form onSubmit={sendMessage}>` handler (line 46) — a genuine submit-event handler, itself gesture-triggered (user pressed Enter/tapped ↑). Receive-cue point: inside the `runWithTypingFloor` callback, `setMessages((current) => [...current, { role: "assistant", content: data.reply ?? ..., card: data.card, suggestedChips: ... }])` — this is the only place the assistant's reply actually lands in state for this surface.
- `sendChip` (line 44): same two shapes — user-content append `setMessages((current) => [...current, { role: "user", content: CHIP_LABELS[chipId] }])` right after the `isSending` guard (called from a chip `<button onClick={() => void sendChip(chipId)}>` at line 46, and also from the `☰` menu button and from `openFromLauncher`'s `sendChipRef.current?.(detail.chipId, ...)` at line 34 — that last one fires from a `CustomEvent` listener, **not** a direct DOM click on this component, see gesture note below), assistant-append is the same `setMessages` shape inside `runWithTypingFloor`.

`app/chat/chat-experience.tsx`:
- `sendMessage` (line 23): identical structure — user append right after the guard, assistant append inside the `runWithTypingFloor` callback, but note this surface routes the response through `interpretChatResponse` first and only appends on `outcome.kind === "reply"` (else branch appends an error-styled assistant message with no `card`) — a receive-cue hookup here needs to fire for both branches (or just the `reply` branch, per whatever the planner decides "reply arrived" means) since both branches represent the "bot responded" event.
- `sendChip` (line 24): same shape as the overlay's version, called from chip buttons (line 25) and the `☰` button (line 25).

## 4. Role-gating

- `CHIP_ROLES["pending-time-off"] = ["admin"]` (`lib/chatbot/chip-labels.ts:12`) — only `admin` role sees/can trigger this chip client-side (both chat surfaces filter `suggestedChips` through `CHIP_ROLES` before rendering, e.g. `chatbot-overlay.tsx:15`, `chat-experience.tsx:22`).
- Independently, the chip handler itself re-checks: `chips.ts:17` calls `adminOnly(session)` first thing, which returns a rejection reply unless `session.role === "admin"` (`chips.ts:7`) — so even a forged/direct POST to whatever chat API resolves chips would still be rejected server-side by role, independent of the client-side chip visibility.
- The mutating endpoint itself has its own **third, independent** check: `requireRoleOrThrow("admin")` (`app/api/staff/time-off/resolve/route.ts:12`) — this is a separate function call, not shared code path with the chatbot's `adminOnly` helper, and per `lib/staff/time-off.ts:11-13`'s comment, the ultimate authority is Postgres RLS policy `time_off_requests_update_admin`, with this in-route check being defense-in-depth on top of RLS. Net: three independent layers (chip visibility filter, chip handler's `adminOnly`, route's `requireRoleOrThrow("admin")` backed by RLS) all gate this — a new in-chat Approve button calling this same route inherits all of them regardless of anything the chat UI does.

## 5. Risks

**Client/server boundary:**
- `app/components/chat-cards.tsx` has no `"use client"` directive of its own. It is currently imported only by two files that do have it: `chat-experience.tsx:1` and `chatbot-overlay.tsx:1`. Since both of `ChatCard`'s only consumers are client components, `chat-cards.tsx` is compiled into the client bundle by inheritance — it never needs its own directive, and it already contains an inline `onClick` handler for the `"disambiguation"` case (`chat-cards.tsx:29`) proving this already works today without issue.
- The existing precedent for "a chip-list card embeds an interactive action" is `OutreachCardActions` (`app/components/outreach-card-actions.tsx`), which **does** declare its own `"use client"` (line 1) despite living inside an already-client module graph — i.e., the codebase's convention is to extract this kind of stateful sub-component into its own file with an explicit `"use client"`, even though it's technically redundant. A new `TimeOffCardActions`-equivalent following this same convention (own file, own `"use client"`, imported into `chat-cards.tsx`) matches existing style; putting it inline directly in `chat-cards.tsx` would also compile correctly (per the disambiguation-case precedent) but breaks from the one-component-per-file convention `OutreachCardActions` set.
- No `"use server"` / server action boundary exists in this codebase's chat card flow — all mutations go through plain `fetch()` to Next.js Route Handlers (`/api/...`), consistent with `RequestsInbox`'s pattern; no barrier expected here.

**Tests:**
- `tests/agent_requirements/activity-log-merge.test.ts` references time-off shapes only in comments/docstring (lines 7-31, e.g. "time-off decision entries", "ActivityEntry (time-off) shape") describing a merge of resolved time-off + class-cancellation records into an activity log — grepped for actual imports: it does not import `lib/time-off/queries.ts`, `chips.ts`, `chat-cards.tsx`, or `chatbot-overlay.tsx` directly (confirmed no matching import lines), so it is describing a *different* time-off-adjacent feature (an activity log merge utility) and is very unlikely to be touched by this task, but the reasonable in the module's docstring is exactly this task's `PendingTimeOffRequest`/resolved-request shape family — worth a second look by whoever touches `lib/time-off/queries.ts` types, in case this test's fixtures assume today's exact field set.
- `tests/agent_requirements/interpret-chat-response.test.ts` imports `RichCard` and `ChipId` types directly (lines 3-5) but does not construct any `kind: "time-off"` card literal anywhere in the file (grep for `time-off`/`kind:` inside it found only an unrelated `kind: "notice"` literal and doc-comment references to `"reply"`/`"error"` outcome kinds) — safe from a `RichCard`'s `"time-off"` variant shape change.
- No test file references `chips.ts`, `chat-cards.tsx`, or `chatbot-overlay.tsx` by name/import anywhere under `tests/` (confirmed via targeted grep, zero matches) — no existing unit test currently exercises the exact code this task changes; acceptance criterion 6 (`npm test` clean) is about not regressing unrelated suites, not about pre-existing coverage of this feature.
- Full `tests/agent_requirements/` directory listing (11 files) for reference: `activity-log-merge`, `cancel-flow-order`, `chat-page-auth-gate`, `deny-pending-requests-on-cancel`, `interpret-chat-response`, `log-class-cancellation`, `resolve-class-type`, `retention-cohort-boundaries`, `update-class-capacity-below-booked`, `merge-refreshed-classes`, `resolve-instructor`.

**Web Audio autoplay policy:**
- Every trigger point identified in section 3 is inside a handler that only runs in direct response to a user gesture: `sendMessage`'s form `onSubmit` (both surfaces), `sendChip`'s button `onClick` (both surfaces, including the `☰` menu button). The one call site worth flagging as *not* a direct DOM event: `chatbot-overlay.tsx:34`'s `openFromLauncher` calls `sendChipRef.current?.(detail.chipId, ...)` from inside a `window.addEventListener("fitbot:open", ...)` `CustomEvent` handler — this event is itself dispatched elsewhere in the app (not opened in this pass) presumably from another user click (e.g., a "view pending time-off" link/button dispatching `fitbot:open` with a `chipId` detail), so it is very likely still gesture-chained, but the direct call site here is an event-listener callback, not a raw click handler, and the event's true origin (whether always itself gesture-sourced) was not traced in this pass — **unknown, minor**: if this path is ever invoked non-gesture-sourced (e.g. on a timer or route load), a `new AudioContext()` created/resumed there could be silently blocked by browser autoplay policy since no prior "user activation" would be on the call stack; confirming the `fitbot:open` dispatch site(s) would close this out but wasn't required reading per the brief's file list.
- Given the above, no `AudioContext`-unlock workaround (e.g. resuming on a generic first-click listener) appears necessary for the primary flows; it's a minor unknown only for the one indirect dispatch path.

## Unknowns

1. The exact server component/page that renders `<RequestsInbox>` and maps `PendingTimeOffRequest` (`full_name`) → `PendingRequest` (`requester_name`) was not located by file path in this pass (only inferred to exist under `app/staff/`); a planner deciding whether the new chat-card action component should share a prop type with `RequestsInbox` should locate this file first.
2. The origin/dispatch site(s) of the `window.dispatchEvent(new CustomEvent("fitbot:open", ...))` that `chatbot-overlay.tsx:34` listens for were not traced — relevant only to the minor autoplay-policy unknown above.
3. Whether any other place in the app besides `app/dashboard/page.tsx` and `lib/time-off/queries.ts` itself consumes `listPendingTimeOffRequests` was answered by grep (only those two files, plus a prior task's plan doc, reference the symbol) — `app/dashboard/page.tsx` itself was not opened in this pass to see exactly how it renders the data (e.g., whether it's the file that feeds `RequestsInbox`, or a separate admin-dashboard display) — flagged for planner if it matters which display pattern is the "canonical" one to mirror beyond `RequestsInbox`.
