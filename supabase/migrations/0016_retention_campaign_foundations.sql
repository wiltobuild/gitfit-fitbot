-- Retention campaign foundations: add bounded member-staleness filtering
-- (Decision 2), allow staff to deliver into a member's FitBot history
-- (Decision 1), and mark promotional chat messages for the future auto-popup
-- behavior (Decision 10). All changes are additive and backward-compatible.

create or replace function public.search_members_by_attributes(p_fitness_level text default null, p_preferred_class_type text default null, p_stale_after_days int default null, p_stale_before_days int default null)
returns table (id uuid, email text, full_name text, auth_user_id uuid, lifecycle_status text, fitness_level text, preferred_class_types text, last_visit_date date, membership_tier text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff(auth.uid()) then raise exception 'Only staff may search members'; end if;
  return query select m.id, m.email, m.full_name, m.auth_user_id, m.lifecycle_status, m.fitness_level, m.preferred_class_types, m.last_visit_date, m.membership_tier from public.members m
  where (p_fitness_level is null or m.fitness_level = p_fitness_level) and (p_preferred_class_type is null or m.preferred_class_types ilike '%' || p_preferred_class_type || '%') and (p_stale_after_days is null or m.last_visit_date <= current_date - p_stale_after_days) and (p_stale_before_days is null or m.last_visit_date >= current_date - p_stale_before_days)
  order by m.last_visit_date asc nulls last;
end; $$;
grant execute on function public.search_members_by_attributes(text, text, int, int) to authenticated;

-- Allow staff/admin to insert an assistant message into any member's chat
-- history for real in-app delivery; SELECT access remains member-only.
create policy "chat_messages_insert_staff"
on public.chat_messages
for insert
to authenticated
with check (public.is_staff(auth.uid()));

-- Mark retention-delivery chat rows so the later auto-popup can distinguish
-- them from ordinary FitBot replies; normal rows remain false by default.
alter table public.chat_messages add column is_promotional boolean not null default false;
