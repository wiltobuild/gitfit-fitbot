-- Enable Realtime replication for the class schedule so a booking or
-- cancellation (which updates classes.booked_count via the AFTER
-- INSERT/DELETE trigger sync_class_booked_count(), see 0005_bookings.sql
-- and 0010_fix_booking_race_and_search_escape.sql) pushes live to open
-- browser tabs instead of requiring a manual reload. RLS already grants
-- every authenticated member select access to the full table
-- (classes_select_authenticated: using (true), see 0004_classes.sql), so
-- this is additive, not a new access surface.

alter publication supabase_realtime add table public.classes;
