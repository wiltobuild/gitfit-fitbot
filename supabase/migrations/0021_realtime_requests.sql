-- Enable Realtime replication for the two request tables so a resolution
-- (or a new submission) pushes to the other party's open browser tab
-- instead of requiring a manual reload. RLS already scopes what each
-- subscriber receives (time_off_requests_select_own_or_admin,
-- class_change_requests_select_own_or_admin) -- Realtime respects RLS for
-- authenticated clients, so this is additive, not a new access surface.

alter publication supabase_realtime add table public.time_off_requests;
alter publication supabase_realtime add table public.class_change_requests;
