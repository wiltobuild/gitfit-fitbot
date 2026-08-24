-- Phase C: class ownership. classes has been read-only since 0004 (SELECT
-- only, no mutation path for anyone). Adds admin-only create/edit/cancel
-- and a `promoted` flag for underbooked classes. Reuses the existing
-- instructor_member_id link from 0019 rather than adding a second
-- "who teaches this" column.

alter table public.classes
  add column promoted boolean not null default false;

create policy "classes_insert_admin"
on public.classes
for insert
to authenticated
with check (public.is_admin(auth.uid()));

create policy "classes_update_admin"
on public.classes
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "classes_delete_admin"
on public.classes
for delete
to authenticated
using (public.is_admin(auth.uid()));
