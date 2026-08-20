create function public.search_members_by_attributes(p_fitness_level text default null, p_preferred_class_type text default null, p_stale_after_days int default null)
returns table (id uuid, email text, full_name text, auth_user_id uuid, lifecycle_status text, fitness_level text, preferred_class_types text, last_visit_date date, membership_tier text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff(auth.uid()) then raise exception 'Only staff may search members'; end if;
  return query select m.id, m.email, m.full_name, m.auth_user_id, m.lifecycle_status, m.fitness_level, m.preferred_class_types, m.last_visit_date, m.membership_tier from public.members m
  where (p_fitness_level is null or m.fitness_level = p_fitness_level) and (p_preferred_class_type is null or m.preferred_class_types ilike '%' || p_preferred_class_type || '%') and (p_stale_after_days is null or m.last_visit_date <= current_date - p_stale_after_days)
  order by m.last_visit_date asc nulls last;
end; $$;
grant execute on function public.search_members_by_attributes(text, text, int) to authenticated;
