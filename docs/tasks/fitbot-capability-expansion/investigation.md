# Investigation: fitbot-capability-expansion (Argus)

## User clarification received mid-investigation (supersedes Decision-1 ambiguity)

While this investigation was running, the user resolved what "admin" means,
directly:

- **New third role: `admin`.** Schema needs updating; a new role, not a
  synonym for staff.
- **The 4 `@pursuit.org` accounts get promoted to `admin`** (they are
  currently `staff` — see Verified Facts). Every other account "stays as
  is" — confirmed below that no other account is `staff`-role today, so
  this is a clean, fully-scoped promotion of exactly 4 rows.
- **Admin capabilities**: sees everything (at minimum, a superset of
  current staff access), plus a genuinely new capability — **approve/deny
  time-off requests** (does not exist for anyone today; see Risk below,
  no UPDATE RLS policy exists on `time_off_requests` yet).
- **Staff**: keep current staff-function access as-is.
- **Clients**: scope confirmed — chatbot, appointments, dashboard only.

This resolves what was the single largest open question. Athena's plan
should treat the three-tier role model as decided, and focus decisions on
*how* to implement it correctly against the scattered exact-role-comparison
sites this investigation found.

## Verified facts

### 1. Role model at the database level

- `supabase/migrations/0001_profiles_and_roles.sql:7` — `profiles.role text not null default 'client' check (role in ('client', 'staff'))`. Never altered by any later migration (0002-0013). No `admin` value, no email allowlist, no other flag anywhere in the schema. The role model is genuinely and only `client` | `staff` today — admin is a from-scratch addition, not hidden plumbing.
- `is_staff(uid)` (0001:16-29) — `security definer`, `select exists(... where id=uid and role='staff')`. Sole staff gate used throughout RLS.
- `protect_profile_role()` trigger (0001:61-76, patched 0002:20-36) — blocks any `profiles.role` change unless caller is already staff, `service_role`, or the literal Postgres superuser. No self-promotion path exists for ordinary clients.
- `handle_new_user()` — always inserts new profiles as `role='client'`.
- **Confirmed via live data (this session's earlier work)**: the only `staff`-role accounts that exist are the 4 `@pursuit.org` accounts created earlier this session. The 3 instructor accounts (Sofia/Marcus/Avery) and all 24 demo member accounts are `role='client'` (the 3 instructors have `is_instructor=true` but are not staff-role) — confirms "keep the rest as is" has nothing else to touch.

### 2. RLS policy inventory (every table)

| Table | Policies | Effective boundary |
|---|---|---|
| `profiles` | self-or-staff select/update | staff can read/update any profile |
| `chat_messages` | own-only select/insert | no staff override at all |
| `classes` | `true` (all authenticated) | any role, full read |
| `bookings` | own-or-staff select; own insert/delete | staff see all bookings |
| `time_off_requests` | staff-only select; own-insert-only | **no UPDATE policy exists — approve/deny not implemented at DB level for anyone** |
| `outreach_messages` | staff-only select/insert/update | clients have zero access |
| `members` | staff-all select; client-own-row select | — |

Security-definer functions: `search_members`, `list_members_for_staff`, `search_members_by_attributes` — all staff-gated via `is_staff(auth.uid())` inside the function body, all `security definer`.

### 3. Access-boundary verification, per intent/chip

**Client-scoped intents never leak cross-user data** — `my-goals.ts`, `my-activity.ts`, `my-appointments.ts`, `book-class.ts`'s cancel path, and the corresponding chips all filter strictly by `session.user.id`, which is derived server-side from the auth cookie (`lib/auth/session.ts`), never from client-supplied request data. No path for a client to substitute another user's id.

**Staff-only intents/chips gate correctly; staff access is intentionally studio-wide (not a bug)**:
- `router.ts:10` — `intent.roles.includes(session.role) && intent.match(...)` is a real, independent server-side gate for free-text intents. Even if a client's message textually matches a staff intent's regex, the intent is skipped because `"client"` isn't in its `roles` array.
- Chips each independently call `staffOnly(session)`/`clientOnly(session)` as their first statement.

**`member-summary` chip's `memberId` path, traced fully — confirmed safe today via two independent layers**:
- `app/api/chat/route.ts` extracts `params.memberId` directly from client-supplied JSON with no validation of ownership.
- `chips.ts`'s `member-summary` handler calls `staffOnly(session)` *before* the memberId is ever used — a client is rejected before reaching the data fetch.
- Even hypothetically bypassing the app check, `getMemberById` queries through the RLS-enforced cookie-scoped client — `members_select_own` would restrict a client to their own row regardless of what id they send. **Two independent layers both block this.**
- For genuine staff, `getMemberById` is intentionally unrestricted across all members (same RLS policy as `search_members`/`list_members_for_staff`) — consistent, not a bug.

**Real gap found — chip authorization is single-layer, unlike intents' two-layer gate**:
- `app/api/chat/route.ts` validates only that `chipId` is a *known key*; it does **not** independently check `session.role` against the chip's intended audience before invoking the handler. Authorization for chips is delegated **entirely** to each handler's internal `staffOnly()`/`clientOnly()` call.
- Intents get two layers of defense (router's structural `roles` array, checked before `match()` even runs); chips get exactly one (the handler's own internal check). **Any new chip that omits this call — or a future admin chip using the wrong helper — leaks silently, with no compiler or runtime backstop today.**

### 4. RichCard inventory and gaps

Exactly 5 kinds today: `schedule`, `members`, `workout`, `time-off`, `outreach` (`lib/chatbot/types.ts`). `chat-cards.tsx` has an exhaustive `never`-typed switch — a new kind added to the union fails to compile until a matching case exists (a real guardrail for the plan).

Gaps found:
- Time-off **creation** confirmation is plain text only, no card (the *lookup* path does get a `time-off` card).
- `book-class.ts` booking success/failure is plain text only, no card at all.
- No card exists for: instructor/class-capacity trend data (visible only in `app/staff/page.tsx`'s UI, not exposed to Fitbot at all), membership tier/status, or per-class attendee rosters (`who-is-booked.ts` explicitly notes member names aren't available there yet).

### 5. Full intent/chip inventory

| id | type | roles | data/action |
|---|---|---|---|
| my-goals | intent+chip | client | own `members` row, read-only |
| my-activity | intent+chip | client | own `members`+`bookings`, read-only |
| my-appointments | intent+chip | client, staff | own `bookings`+`classes`, read-only |
| book-class | intent | client, staff | `bookings` insert/delete via shared `reserveBooking`/`cancelBooking` |
| schedule | intent | client, staff | `classes`, read-only, all rows |
| who-is-booked | intent | staff | `classes.booked_count`, read-only |
| member-lookup | intent+chip | staff | `search_members` + a found member's `bookings` |
| workout-plan | intent+chip(x2) | client, staff | none (pure generation) |
| time-off | intent | staff | own `time_off_requests`, select+insert (no approve path) |
| retention-lookup | intent+chip | staff | `list_members_for_staff`, filtered by `lifecycle_status` |
| outreach-draft | intent | staff | `search_members` + `outreach_messages` insert |
| outreach-send | intent | staff | `search_members` + `outreach_messages` update |
| members-by-attribute | intent | staff | `search_members_by_attributes` |
| help | intent | client, staff | static text (now returns full chip menu via default-fill) |
| build-consistency | chip | none (both) | static text |
| retention-outreach | chip | staff | same as retention-lookup |
| time-off-coverage | chip | staff | `classes`+`time_off_requests`+`list_members_for_staff` cross-joined |
| member-summary | chip | staff | `getMemberById`, any member, staff-wide by design |
| todays-schedule | chip | none (both) | `classes`, today only |
| menu | chip | none (both) | static, role-appropriate suggested chips |

### 6. Matching brittleness — confirmed real, with concrete failing examples

- `book-class.ts` requires a small fixed phrase set (`book me (into|a)`, `reserve`, `sign me up for`, `cancel my`) — "Can you get me a spot in tomorrow's yoga class" fails to match.
- `member-lookup.ts` requires "look up member" / "find a member" / etc. — "can you pull up Jane Smith's account" fails.
- `time-off.ts` requires a fixed phrase list — "I won't be able to work this Friday" fails despite being a clear PTO request.
- `outreach-draft.ts` requires the literal trigger "draft outreach for" etc. — "can you write something to win back Sarah" fails.
- `intents/index.ts` and `schedule.ts`'s `otherIntentShaped` exclusion list are both organically-grown, ad hoc collision fixes with a comment noting "this list is expected to grow" — evidence that broader phrasing tolerance needs a more structural disambiguation approach, not just longer regex lists, or collisions will reappear faster than they can be patched.

### 7. Untapped functionality

- `app/staff/page.tsx`'s capacity "fill level" classification and current/next-class detection exist only in page UI logic — no Fitbot equivalent.
- `membership_tier`/`membership_status` changes don't exist as app functionality anywhere yet (not just missing from Fitbot) — out of scope for "expose existing functionality."
- No waitlists, payments, trainer assignment, or class reviews exist anywhere in the app.

### 8. Session/auth architecture — blast radius for the third role (now confirmed needed)

- `lib/auth/session.ts` — `UserRole = "client" | "staff"` is a string literal union. `getSession()`'s `profile?.role === "staff" ? "staff" : "client"` line is the **highest-blast-radius spot**: any third `profiles.role` value would silently collapse to `"client"` here today.
- `requireRoleOrRedirect`/`requireRoleOrThrow` both take a hardcoded `role: "staff"` parameter — signatures need widening for admin-only or admin-or-staff gates.
- **Every exact two-way role comparison found** (all need deliberate updating for admin, cataloged for Athena):
  - `app/dashboard/page.tsx` — badge text, "Open staff zone" link visibility.
  - `app/page.tsx` — homepage content gating.
  - `app/components/nav-links.tsx` — staff nav link only added for `role === "staff"` exactly; admin would not get it by default.
  - `app/api/chat/route.ts` — `STAFF_MENU`/`CLIENT_MENU` ternary; admin falls to `CLIENT_MENU` by default.
  - `lib/chatbot/intents/help.ts` — same staff/else pattern.
  - `lib/chatbot/chips.ts`'s `staffOnly`/`clientOnly` — exact-match, admin would be **rejected from both** by default (fail-closed, not fail-open — safe direction, but would silently under-deliver rather than error).
  - `router.ts` — every intent's `roles: Array<"client"|"staff">`; admin matches **none** of the 14 intents today until each is updated.
- `proxy.ts` does no role-based authorization at all (only cookie refresh + unauthenticated redirect) — its own comment confirms `lib/auth/session.ts` is the single real enforcement point. No proxy changes needed for admin.

## Inferences

- **(High confidence)** The two-layer defense for intents vs. single-layer for chips is an undocumented asymmetry, not a deliberate design choice — nothing explains why chips don't get the same structural gate.
- **(Medium confidence)** The codebase's de facto convention is "fail toward least-privilege" — an unhandled role value is generally under-privileged, not over-privileged — except `getSession()`'s collapse to `"client"`, where an admin profile would be treated as a full ordinary client (not locked out, but also not elevated).

## Unknowns

- Whether the chat UI (`chatbot-overlay.tsx`/`chat-experience.tsx`) independently filters which chips are *rendered* per role, vs. relying entirely on the server's `suggestedChips` — not traced in this pass, relevant to Requirement 3's "visibility" vs. "capability."

## Risks

- **Chip authorization is single-layer** — any new chip (this task adds several) that omits its role-check call leaks silently, with no structural backstop today. Athena's plan should address this directly, not just add more chips on the same unguarded pattern.
- **Exact string role comparisons scattered across ~9 call sites** — adding `admin` is not a single-point change; several sites will otherwise silently exclude admin from all current capabilities rather than erroring, which could look like "the migration worked, admin just can't do much yet" during testing.
- **`time_off_requests` has no UPDATE RLS policy** — approve/deny (now a confirmed required admin capability) needs a new migration, not just application code.
- **Matching-collision fragility is already at a documented breaking point** — broader phrasing tolerance (Requirement 5) will multiply trigger phrases per intent; without a more structural disambiguation approach, collision bugs will likely reappear faster than they can be patched one regex at a time.
