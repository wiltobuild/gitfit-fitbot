-- Shared member records, including people who do not have an Auth account.

create table public.members (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  first_name text,
  last_name text,
  full_name text,
  birthdate date,
  phone text,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  join_date date,
  membership_tier text check (membership_tier in ('basic', 'premium')),
  membership_status text check (membership_status in ('active', 'paused', 'cancelled')),
  last_visit_date date,
  lifecycle_status text not null default 'active' check (lifecycle_status in ('active', 'at_risk', 'lapsed')),
  goals text,
  preferred_class_types text,
  fitness_level text check (fitness_level in ('beginner', 'intermediate', 'advanced')),
  staff_notes text,
  is_instructor boolean not null default false,
  created_at timestamptz not null default now()
);

-- Members are seeded with the service-role key. Ordinary application requests
-- have read-only access: staff may read all records and clients only their own.
alter table public.members enable row level security;

create policy "members_select_staff"
on public.members
for select
to authenticated
using (public.is_staff(auth.uid()));

create policy "members_select_own"
on public.members
for select
to authenticated
using (auth_user_id = auth.uid());
