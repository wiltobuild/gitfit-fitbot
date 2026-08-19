-- Canonical class schedule for read-only schedule queries.
create table public.classes (
  id text primary key,
  name text not null,
  type text not null,
  instructor text not null,
  class_date date not null,
  start_time time not null,
  duration_minutes int not null,
  capacity int not null,
  booked_count int not null default 0
);

alter table public.classes enable row level security;

-- All authenticated members can view the class schedule.
create policy "classes_select_authenticated"
on public.classes
for select
to authenticated
using (true);

insert into public.classes (
  id, name, type, instructor, class_date, start_time, duration_minutes, capacity, booked_count
)
values
  ('class_001', 'Morning Flow', 'Yoga', 'Sofia Martinez', '2026-08-17', '07:00', 60, 20, 14),
  ('class_002', 'Power Cycle', 'Cycling', 'Marcus Lee', '2026-08-17', '09:00', 45, 18, 18),
  ('class_003', 'HIIT 45', 'HIIT', 'Avery Thompson', '2026-08-17', '18:00', 45, 16, 12),
  ('class_004', 'Sunset Yoga', 'Yoga', 'Sofia Martinez', '2026-08-17', '19:30', 60, 20, 9),
  ('class_005', 'Rise & Ride', 'Cycling', 'Marcus Lee', '2026-08-18', '07:00', 45, 18, 11),
  ('class_006', 'Core & Sculpt', 'HIIT', 'Avery Thompson', '2026-08-18', '12:00', 45, 16, 13),
  ('class_007', 'Evening Flow', 'Yoga', 'Sofia Martinez', '2026-08-18', '18:30', 60, 20, 7),
  ('class_008', 'Power Cycle', 'Cycling', 'Marcus Lee', '2026-08-19', '07:00', 45, 18, 15),
  ('class_009', 'Full Body HIIT', 'HIIT', 'Avery Thompson', '2026-08-19', '18:00', 45, 16, 16),
  ('class_010', 'Restorative Flow', 'Yoga', 'Sofia Martinez', '2026-08-19', '19:30', 60, 20, 10),
  ('class_011', 'Morning HIIT', 'HIIT', 'Avery Thompson', '2026-08-20', '07:00', 45, 16, 13),
  ('class_012', 'Midday Flow', 'Yoga', 'Sofia Martinez', '2026-08-20', '12:00', 60, 20, 6),
  ('class_013', 'Night Ride', 'Cycling', 'Marcus Lee', '2026-08-20', '18:30', 45, 18, 17),
  ('class_014', 'Friday Flow', 'Yoga', 'Sofia Martinez', '2026-08-21', '07:00', 60, 20, 12),
  ('class_015', 'Friday HIIT', 'HIIT', 'Avery Thompson', '2026-08-21', '17:30', 45, 16, 14),
  ('class_016', 'Weekend Cycle', 'Cycling', 'Marcus Lee', '2026-08-22', '09:00', 45, 18, 10),
  ('class_017', 'Saturday Sculpt', 'HIIT', 'Avery Thompson', '2026-08-22', '10:30', 45, 16, 15),
  ('class_018', 'Weekend Wind Down', 'Yoga', 'Sofia Martinez', '2026-08-22', '16:00', 60, 20, 8),
  ('class_019', 'Sunday Reset', 'Yoga', 'Sofia Martinez', '2026-08-23', '09:00', 60, 20, 13),
  ('class_020', 'Sunday Sweat', 'HIIT', 'Avery Thompson', '2026-08-23', '10:30', 45, 16, 11);
