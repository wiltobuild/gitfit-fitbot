-- Per-user class bookings, with class capacity and booked-count enforcement.

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  class_id text not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (class_id, user_id)
);

-- Members can manage only their own bookings. Staff may read all bookings for
-- member-lookup workflows, using the role helper established in 0001.
alter table public.bookings enable row level security;

create policy "bookings_select_own_or_staff"
on public.bookings
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_staff(auth.uid())
);

create policy "bookings_insert_own"
on public.bookings
for insert
to authenticated
with check (user_id = auth.uid());

create policy "bookings_delete_own"
on public.bookings
for delete
to authenticated
using (user_id = auth.uid());

-- Reject a reservation before the AFTER INSERT trigger increments booked_count.
-- The security definer context permits this check against classes for ordinary
-- authenticated members.
create or replace function public.ensure_class_has_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_booked_count int;
  class_capacity int;
begin
  select booked_count, capacity
  into current_booked_count, class_capacity
  from public.classes
  where id = new.class_id;

  if current_booked_count >= class_capacity then
    raise exception 'Class is full';
  end if;

  return new;
end;
$$;

create trigger ensure_class_has_capacity_before_insert
before insert on public.bookings
for each row execute function public.ensure_class_has_capacity();

-- Keep the schedule's denormalized booked count synchronized as bookings are
-- created and cancelled. This runs as the table owner because members do not
-- have direct UPDATE rights on classes.
create or replace function public.sync_class_booked_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.classes
    set booked_count = booked_count + 1
    where id = new.class_id;
  elsif tg_op = 'DELETE' then
    update public.classes
    set booked_count = booked_count - 1
    where id = old.class_id;
  end if;

  return null;
end;
$$;

create trigger sync_class_booked_count_after_insert
after insert on public.bookings
for each row execute function public.sync_class_booked_count();

create trigger sync_class_booked_count_after_delete
after delete on public.bookings
for each row execute function public.sync_class_booked_count();
