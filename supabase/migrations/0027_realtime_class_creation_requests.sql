-- Enable Realtime replication for class_creation_requests so a trainer's
-- proposal and a manager's approve/deny decision push live to both consoles
-- without a manual reload, mirroring 0025_realtime_classes.sql. RLS already
-- scopes visibility to the requester or an admin
-- (class_creation_requests_select_own_or_admin, see 0026), so this is
-- additive, not a new access surface.

alter publication supabase_realtime add table public.class_creation_requests;
