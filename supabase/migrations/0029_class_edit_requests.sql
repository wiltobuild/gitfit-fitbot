-- Retire 'swap' in favor of 'edit'. swap_with_member_id was never wired to
-- any actual "pick who to swap with" UI -- the button just submitted a bare
-- type='swap' flag. Worse, approving OR denying either request type had
-- zero effect on the class itself: resolveClassChangeRequest only ever
-- flipped the request's own status column. 'edit' replaces that dead end
-- with a real proposal: a trainer submits specific field changes to a class
-- they teach, and approval actually applies them via the existing
-- updateClass() path (see lib/class-changes/queries.ts). Approving a
-- 'cancel' request is fixed the same way, now running the real deleteClass()
-- flow instead of a no-op.

-- A CHECK constraint validates all existing rows the instant it's (re)added,
-- so neither ordering of "update the data" vs "tighten the constraint"
-- works alone: tightening first rejects the still-'swap' rows, updating
-- first violates the still-'swap'-only constraint. Widen to allow all three
-- values, migrate the data, then tighten to the final two.
alter table public.class_change_requests drop constraint class_change_requests_type_check;
alter table public.class_change_requests add constraint class_change_requests_type_check check (type in ('swap', 'edit', 'cancel'));

update public.class_change_requests set type = 'edit' where type = 'swap';

alter table public.class_change_requests drop constraint class_change_requests_type_check;
alter table public.class_change_requests add constraint class_change_requests_type_check check (type in ('edit', 'cancel'));

alter table public.class_change_requests drop column swap_with_member_id;

alter table public.class_change_requests add column proposed_name text;
alter table public.class_change_requests add column proposed_type text;
alter table public.class_change_requests add column proposed_class_date date;
alter table public.class_change_requests add column proposed_start_time time;
alter table public.class_change_requests add column proposed_duration_minutes int;
alter table public.class_change_requests add column proposed_capacity int;
