# Plan — Phase A: manager flag on the existing staff role

**SUPERSEDED 2026-08-20 — no `is_manager` flag needed.** User's read: the
`admin` role merged in from `main` (`0014_admin_role.sql`) already *is*
the manager tier — `role = 'admin'` means manager-level access,
`role = 'staff'` means trainer-level access. Adding a separate boolean on
top of that would just be a second way to say the same thing. Phase A as
a distinct piece of work is done — the trainer/manager split already
exists via `role`, courtesy of `0014`.

**What this means going forward**: Phases B–D (whatever needs a
manager-only gate — approving requests, editing others' certs, etc.)
should check `is_admin(uid)` in SQL / `session.role === "admin"` in code,
the same way `0014`'s own `time_off_requests_update_admin` policy already
does. No new migration, no new `SessionUser` field — `lib/auth/session.ts`
is unchanged from what `main` merged in.

**Implementation attempt and revert, for history**: earlier in this
session, before this was raised, a boolean-flag version was built —
migration `0015_manager_flag.sql` (`is_manager` column + `is_manager(uid)`
helper treating `admin` as an automatic pass) and matching
`lib/auth/session.ts` changes (`isManager`, `requireManagerOrRedirect`/
`Throw`). Both were reverted in full once the simpler admin-is-manager
reading was raised — no trace left in the working tree. See the
2026-08-20 entries in `docs/agent/decisions.md` for the full sequence
(original approval → implementation → admin-superset fix → revert).

The original boolean-flag plan (obsolete, kept below only as a record of
what was considered and why it was dropped) started here:

---

Athena-role plan, per `docs/agent/workflow.md`'s standard Feature row
(Argus → Athena → **approval** → Codex → Themis → Apollo).

Branch: `operations-dashboard` (not `main`, per the 2026-08-19 decision).

**Revision note**: this replaces an earlier version of this plan that
proposed a 3-value `role` enum (`client`/`trainer`/`manager`). User
correctly pushed back (2026-08-19): a boolean flag on the existing
`client`/`staff` role is simpler and touches far less of the codebase,
since `role` never changes value or type.

## Scope (as originally drafted)

Give "staff" a manager/trainer distinction via a boolean flag, enforced by
Postgres RLS.

```sql
-- Phase A: distinguish manager-level staff from trainer-level staff via a
-- boolean flag, instead of a third role value.

alter table public.profiles
  add column is_manager boolean not null default false;

alter table public.profiles
  add constraint profiles_is_manager_requires_staff
  check (not is_manager or role = 'staff');

update public.profiles set is_manager = true where role = 'staff';

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

drop policy if exists "profiles_update_self_or_staff" on public.profiles;

create policy "profiles_update_self_or_manager"
on public.profiles
for update
to authenticated
using (id = auth.uid() or public.is_manager(auth.uid()))
with check (id = auth.uid() or public.is_manager(auth.uid()));
```

(Verification/rollback sections omitted here — never applied to the live
database, so there is nothing to roll back.)
