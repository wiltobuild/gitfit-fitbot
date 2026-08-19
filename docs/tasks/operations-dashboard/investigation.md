# Investigation — Operations Dashboard (Product B)

Argus-role findings, per `docs/agent/workflow.md`. Covers the full suite
schema as it exists today, plus the additions Phases A–D (+ partial E)
need. Source: direct read of every file in `supabase/migrations/` and
every role-check call site in `app/`/`lib/` — see the reconciliation in
`GitFit Product B - Context for Claude Code.md` for how this maps back to
Product B's original doc.

---

## 1. Schema as it exists today (migrations 0001–0010)

### `profiles`
The role source of truth for every authenticated user.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `references auth.users(id) on delete cascade` |
| `role` | text | `check (role in ('client','staff'))`, default `'client'` |
| `full_name` | text | added `0006`, optional, collected at sign-up |
| `created_at` | timestamptz | default `now()` |

Trigger `on_auth_user_created` inserts a row here (role `client`) whenever
Supabase creates an `auth.users` row. Trigger `protect_profile_role_before_update`
blocks anyone but staff (or a direct `postgres`/`service_role` connection —
the Supabase Studio dashboard-provisioning exemption from `0002`) from
changing `role`. Helper `is_staff(uid)` (security definer, avoids RLS
recursion) is what every other table's staff-facing policy calls.

### `classes`
Canonical studio schedule. **Read-only** today — seeded once in `0004`,
no staff mutation path exists.

| Column | Type | Notes |
|---|---|---|
| `id` | text PK | e.g. `class_001` |
| `name`, `type`, `instructor` | text | `instructor` is a **plain string** (e.g. "Sofia Martinez") — not linked to any `profiles` row |
| `class_date` | date | |
| `start_time` | time | |
| `duration_minutes`, `capacity`, `booked_count` | int | `booked_count` is denormalized, kept in sync by triggers on `bookings` |

SELECT open to all authenticated users. No INSERT/UPDATE/DELETE policy —
nobody, staff included, can mutate a class today.

### `bookings`
Per-member reservations, owned by the client-facing "Book a Class" module.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `class_id` | text | `references classes(id) on delete cascade` |
| `user_id` | uuid | `references auth.users(id) on delete cascade` |
| `created_at` | timestamptz | |
| unique | | `(class_id, user_id)` — one booking per member per class |

`ensure_class_has_capacity()` (row-locked with `for update` since the
`0010` race-condition fix) blocks insert past capacity.
`sync_class_booked_count()` keeps `classes.booked_count` in sync on
insert/delete. SELECT: own rows, or any staff (`is_staff`).

### `chat_messages`
Fitbot conversation history, strictly own-rows-only (no staff override —
this is the one table staff cannot read across users).

### `time_off_requests`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid | requester |
| `requested_date` | date | |
| `reason` | text | nullable |
| `status` | text | `pending \| approved \| denied`, default `pending` |
| `created_at` | timestamptz | |
| `reviewed_by`, `reviewed_at` | uuid / timestamptz | **reserved, unused** — no UPDATE policy exists, so nothing can actually resolve a request yet |

SELECT: any staff sees **every** request (not scoped to the requester).
INSERT: own rows only, staff only.

### `outreach_messages`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `target_user_id` | uuid | the member being reached out to |
| `staff_user_id` | uuid | who drafted/sent it |
| `subject`, `body` | text | |
| `status` | text | `draft \| sent` |
| `created_at`, `sent_at` | timestamptz | |

Staff-only end to end (select/insert/update all gated on `is_staff`). No
client-facing read path exists — matches the recorded decision that
outreach ended up staff-only by design.

### RPCs
- `search_members(search_term)` — staff-only, ILIKE-searches
  `auth.users.email` / `profiles.full_name`, wildcard-escaped since `0010`.
- `is_staff(uid)` — security-definer role check, called by nearly every
  other table's policy.

---

## 2. Additions needed for the Operations Dashboard (Phases A–D, + partial E)

### Phase A — role split (no new tables)
- `profiles.role` check constraint widened: `client | trainer | manager`.
  Existing `staff` rows backfill to `manager` (preserves current
  full-studio-visibility behavior — today's `staff` accounts behave like a
  manager, not a trainer scoped to one week).
- `is_staff(uid)` redefined as `role in ('trainer','manager')` — every
  existing policy that already calls it (bookings, time_off, outreach,
  member-lookup) keeps working unmodified.
- New `is_manager(uid)` helper for manager-exclusive writes (Phases B–D).
- `protect_profile_role` trigger and the `profiles` UPDATE policy switch
  their guard from `is_staff` to `is_manager` (a trainer should not be able
  to edit another profile or any role, only their own) — the `postgres`
  session exemption from `0002` is preserved unchanged.

### Phase B — request resolution + trainer scoping
- `time_off_requests.type` column added: `time_off | shift_swap`.
- New UPDATE policy: manager-only, can set `status`/`reviewed_by`/`reviewed_at`.
- SELECT policy narrowed: trainer sees only `user_id = auth.uid()`, manager
  sees all (today: any staff sees all — this is the biggest real gap
  versus Product B's model).

### Phase C — class ownership
- `classes.trainer_id uuid references profiles(id)`, nullable.
- `classes.promoted boolean default false`.
- New manager-only INSERT/UPDATE/DELETE policies on `classes` (none exist
  today beyond open SELECT).
- Seed data stays generic — the existing `instructor` text field (Sofia/
  Marcus/Avery) is not remapped onto real accounts as part of this phase;
  real trainer accounts get created and linked via `trainer_id` whenever
  the DB is actually populated with them.

### Phase D — promotion + certifications
```sql
promo_events (
  id uuid primary key default gen_random_uuid(),
  class_id text references classes(id) on delete cascade,
  promoted_by uuid references profiles(id),
  sent_to_count int not null default 0,
  created_at timestamptz not null default now()
)
```
Manager-only INSERT. Trainer capability is "flag to manager," not a DB
write — likely just a UI/chat affordance, no new table needed for the flag
itself unless we want it durable (open question, not yet decided).

`profiles` gains `spec text`, `cert_name text`, `cert_expiry date`. Trainer
can update their own (already covered by the Phase A self-update RLS
carve-out); manager can update anyone's.

Underbooked threshold, per Product B's shared vocabulary: `booked_count / capacity < 0.45`.

### Phase E (partial — at-risk visibility only, activity feed cut)
No schema proposed yet. `lib/chatbot/intents/retention-lookup.ts` already
computes some notion of "worth re-engaging" for the outreach flow — needs
a direct read before deciding whether a new `at_risk_flags` table is
justified or whether exposing that existing logic to managers is enough.
**Not yet investigated — flagged for Phase E's own investigation pass,
not decided here.**

---

## 3. Suite-wide invariants this schema already respects (Product B §8)

- Single ID space: every FK above points at `profiles.id` /
  `auth.users.id` — nothing invents a local id.
- RLS enforces every role boundary at the database level already (no
  table in this suite relies on UI-only gating) — Phases A–D extend that
  pattern, they don't introduce a new one.
- `classes` remains the single source of truth suite-wide; Phase C adds
  staff mutation to it rather than forking a parallel table.
