# Plan — Phase A: manager flag on the existing staff role

Athena-role plan, per `docs/agent/workflow.md`'s standard Feature row
(Argus → Athena → **approval** → Codex → Themis → Apollo). Covers Phase A
only — B/C/D each get their own plan once A has shipped and been verified.

Branch: `operations-dashboard` (not `main`, per the 2026-08-19 decision).

**Revision note**: this replaces an earlier version of this plan that
proposed a 3-value `role` enum (`client`/`trainer`/`manager`). User
correctly pushed back (2026-08-19): a boolean flag on the existing
`client`/`staff` role is simpler and touches far less of the codebase,
since `role` never changes value or type. Superseded version is not kept
separately — this file is the live plan.

---

## Scope

Give "staff" a manager/trainer distinction via a boolean flag, enforced by
Postgres RLS. **No new screens, no visible feature change** for anyone
currently signed in as staff — foundational plumbing Phases B–D build on.

## 1. Migration — `supabase/migrations/0013_manager_flag.sql`

Renumbered from `0011` (2026-08-20): `main` merged in `0011_members_table.sql`
and `0012_retarget_outreach_and_search_members.sql` (the shared-member-data
task) while this plan was awaiting approval. No conflict with this plan's
content — that work only touches `members`/`outreach_messages` and reuses
`is_staff(auth.uid())` as-is; this migration only touches `profiles` and
adds `is_manager`. Just a number collision, resolved by taking the next
free slot.

```sql
-- Phase A: distinguish manager-level staff from trainer-level staff via a
-- boolean flag, instead of a third role value. `role` stays
-- client|staff unchanged. Run manually in the Supabase SQL Editor, after
-- 0010.

-- 1. The flag itself. A client can never carry it — enforced at the
--    constraint level, not just by convention, so a stray Table Editor
--    checkbox click on a client row can't grant manager access.
alter table public.profiles
  add column is_manager boolean not null default false;

alter table public.profiles
  add constraint profiles_is_manager_requires_staff
  check (not is_manager or role = 'staff');

-- 2. Backfill: existing staff accounts become managers, preserving their
--    current full-studio-visibility behavior (today's staff already act
--    like a manager, not a week-scoped trainer). Anyone who should be
--    trainer-only gets flipped back to is_manager = false afterward via
--    the Table Editor, same manual-provisioning pattern already in use
--    for role itself.
update public.profiles set is_manager = true where role = 'staff';

-- 3. Manager-only helper, for this migration's own use and for Phases
--    B-D's class/request/cert mutations. is_staff(uid) is untouched —
--    "staff" still means role = 'staff', exactly as today.
create or replace function public.is_manager(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.role = 'staff' and p.is_manager
  );
$$;

-- 4. Tighten the role-change trigger to manager-only. The
--    session_user <> 'postgres' exemption from 0002 (Supabase Studio's
--    Table Editor, used for dashboard-only provisioning) is preserved
--    unchanged.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role is distinct from new.role
     and auth.role() is distinct from 'service_role'
     and session_user is distinct from 'postgres'
     and not public.is_manager(auth.uid()) then
    raise exception 'Only a manager may change a profile role';
  end if;
  return new;
end;
$$;

-- 5. Tighten the profile UPDATE policy the same way: trainer-level staff
--    may only edit their own row (needed for Phase D's self-editable
--    cert fields); a manager may still edit anyone's.
drop policy if exists "profiles_update_self_or_staff" on public.profiles;

create policy "profiles_update_self_or_manager"
on public.profiles
for update
to authenticated
using (id = auth.uid() or public.is_manager(auth.uid()))
with check (id = auth.uid() or public.is_manager(auth.uid()));

-- profiles_select_self_or_staff (0001) is left as-is: every staff account
-- still needs broad profile visibility for member lookup and roster
-- views. Nothing in Phase A restricts SELECT.
```

**⚠️ Same one behavior change as before, still flagged for explicit
sign-off**: today *any* staff account can edit *any* profile. After this
migration, only a manager (`is_manager = true`) can edit someone else's
profile — trainer-level staff can only edit their own. Correct read of
Product B's permission table, but a real narrowing of current behavior.

## 2. Code changes

Because `role` itself never changes, the footprint is small — **one file**
plus the migration:

**`lib/auth/session.ts`**:
- `SessionUser` gains `isManager: boolean`.
- `getSession()` additionally selects `is_manager` alongside `role` and
  sets it on the returned session.
- Two new functions, `requireManagerOrRedirect()` /
  `requireManagerOrThrow()` — check `session.isManager`, unused until
  Phase B but added now since the type work is already here.
- Everything else (`UserRole`, `requireRoleOrRedirect("staff")`,
  `requireRoleOrThrow("staff")`, `requireRoleOrRedirect`/`Throw`
  signatures) is **unchanged** — `"staff"` never stopped being the role.

**Nothing else moves**: all 11 intents' `roles: ["staff"]` /
`["client","staff"]` arrays, the 3 UI role checks (`dashboard/page.tsx`,
`page.tsx`, `nav-links.tsx`), and the 3 `requireRoleOrRedirect("staff")` /
`requireRoleOrThrow("staff")` call sites (`app/staff/page.tsx`,
`app/api/staff/members/route.ts`, `app/api/staff-ping/route.ts`) stay
exactly as they are today. No `lib/auth/roles.ts` split is needed either
(the client/server import-safety problem that motivated it only existed
because of the `UserRole` type change, which no longer happens).

## 3. Verification (Apollo step)

1. `npm run lint` and `npm run build` clean.
2. Apply `0013` manually via the Supabase SQL Editor.
3. Live-test against the real project:
   - Existing (pre-migration) staff account now has `is_manager = true`;
     sign-in, `/staff`, member lookup, time-off submission, outreach
     draft/send all behave identically to before — pure regression check.
   - Manually flip a second test account's `is_manager` to `false` via
     Table Editor; confirm it still reaches `/staff` and every staff-gated
     route/intent identically (Phase A doesn't scope trainer visibility
     down yet — that's B/C).
   - Client account still blocked from `/staff` and both staff API routes,
     and confirm the new constraint rejects `is_manager = true` on a
     client row directly (constraint violation, not silently ignored).
   - **Targeted test for the flagged behavior change**: trainer-level
     staff (`is_manager = false`) can still update their own profile, but
     an update attempt against another user's profile now fails where it
     would have succeeded pre-migration; a manager's cross-profile update
     still succeeds.
   - Confirm the Table Editor role-flip workflow (the `postgres` session
     exemption) still works.
4. Chatbot smoke test: `help` and one staff-only intent (`schedule`) still
   route correctly regardless of `is_manager` value, and remain correctly
   inaccessible to a `client` phrase attempt.

## 4. Rollback

Manually applied (no automated runner) — if verification fails before
apply, nothing has changed. If issues surface after apply, a follow-up
migration drops the column/constraint and restores the prior
`protect_profile_role`/UPDATE-policy definitions; no data is lost since
this phase only adds a column and touches function/policy definitions.

---

## Decision requiring your sign-off before Codex implements this

Same as before, restated for this design: the profile-UPDATE narrowing in
§1 item 5 (only `is_manager = true` staff, not any staff, can edit someone
else's profile going forward).
