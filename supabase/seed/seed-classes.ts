// Generates a rolling 5-week (35-day) window of studio classes starting from
// the Monday of the week containing whenever this script is run, so the
// calendar always has real data relative to "today" instead of a fixed
// range that goes stale (see docs/tasks/dashboard-role-refactor/plan.md
// Decision 5).
//
// Idempotent and safe to re-run: generated rows use the distinguishable ID
// namespace `class_gen_<YYYYMMDD>_<slot>` (never overlapping the hand-seeded
// class_001-class_029 rows). Re-running deletes and regenerates only rows in
// its own namespace for the target date range, and refuses to touch any
// generated row that already has booked_count > 0 -- it's never safe to
// silently destroy real booking data.
//
// Run with: npx tsx supabase/seed/seed-classes.ts
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.

import { faker } from "@faker-js/faker";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Fixed seed keyed to the run date (not a global constant) so the generated
// week-to-week variance is reproducible for a given run date, but a script
// run on a different day produces a different (still deterministic) mix --
// consistent with member-data.ts's reproducibility convention, adapted for
// a rolling window instead of a one-time fixed dataset.
const WEEKS = 5;
const DAYS = WEEKS * 7;

type Instructor = { full_name: string; classType: string; namePrefix: string };

const INSTRUCTORS: Instructor[] = [
  { full_name: "Sofia Martinez", classType: "Yoga", namePrefix: "Flow" },
  { full_name: "Marcus Lee", classType: "Cycling", namePrefix: "Ride" },
  { full_name: "Avery Thompson", classType: "HIIT", namePrefix: "Circuit" },
  { full_name: "Diego Reyes", classType: "Boxing", namePrefix: "Boxing" },
  { full_name: "Elena Cruz", classType: "Pilates", namePrefix: "Pilates" },
  { full_name: "Jordan Blake", classType: "Strength", namePrefix: "Strength" },
];

const WEEKDAY_SLOT_TIMES = ["07:00", "12:00", "17:30"];
const WEEKEND_SLOT_TIMES = ["09:00", "10:30"];
const NAME_VARIANTS = ["Morning", "Midday", "Evening", "Power", "Restorative", "Express", "Deep", "Core"];

function mondayOf(date: Date) {
  const day = date.getDay();
  const offset = (day + 6) % 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - offset);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function dateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function main() {
  const today = new Date();
  const startMonday = mondayOf(today);
  const runDateKey = dateString(today).replaceAll("-", "");
  faker.seed(Number(runDateKey));

  const { data: members, error: memberError } = await supabase
    .from("members")
    .select("id, full_name")
    .eq("is_instructor", true);
  if (memberError) throw memberError;

  const memberIdByName = new Map(members.map((m) => [m.full_name, m.id as string]));
  for (const instructor of INSTRUCTORS) {
    if (!memberIdByName.has(instructor.full_name)) {
      throw new Error(`No members row found for instructor "${instructor.full_name}" -- run seed-members.ts / seed-new-instructors.ts first.`);
    }
  }

  const rangeStart = dateString(startMonday);
  const rangeEndDate = new Date(startMonday);
  rangeEndDate.setDate(startMonday.getDate() + DAYS - 1);
  const rangeEnd = dateString(rangeEndDate);

  // Refuse to touch any of our own previously-generated rows in this date
  // range that already have real bookings -- the load-bearing safety
  // property that makes it safe to re-run this script repeatedly.
  const { data: existingGenerated, error: existingError } = await supabase
    .from("classes")
    .select("id, booked_count")
    .like("id", "class_gen_%")
    .gte("class_date", rangeStart)
    .lte("class_date", rangeEnd);
  if (existingError) throw existingError;

  const bookedExisting = (existingGenerated ?? []).filter((row) => row.booked_count > 0);
  if (bookedExisting.length > 0) {
    throw new Error(
      `Refusing to regenerate: ${bookedExisting.length} previously-generated class(es) in this date range already have real bookings ` +
      `(e.g. ${bookedExisting[0].id}, booked_count=${bookedExisting[0].booked_count}). Resolve manually before re-running.`
    );
  }

  const deletableIds = (existingGenerated ?? []).map((row) => row.id);
  if (deletableIds.length > 0) {
    const { error: deleteError } = await supabase.from("classes").delete().in("id", deletableIds);
    if (deleteError) throw deleteError;
  }

  const rows: Array<{
    id: string;
    name: string;
    type: string;
    instructor: string;
    instructor_member_id: string;
    class_date: string;
    start_time: string;
    duration_minutes: number;
    capacity: number;
    booked_count: number;
  }> = [];

  for (let dayOffset = 0; dayOffset < DAYS; dayOffset++) {
    const day = new Date(startMonday);
    day.setDate(startMonday.getDate() + dayOffset);
    const dayOfWeek = day.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const slotTimes = isWeekend ? WEEKEND_SLOT_TIMES : WEEKDAY_SLOT_TIMES;
    const dateKey = dateString(day);

    for (const instructor of INSTRUCTORS) {
      slotTimes.forEach((startTime, slotIndex) => {
        // Seeded variance: skip roughly 1 in 4 weekday slots and 1 in 3
        // weekend slots so the week doesn't look mechanically identical
        // week-to-week.
        const skipChance = isWeekend ? 0.34 : 0.25;
        if (faker.number.float({ min: 0, max: 1 }) < skipChance) return;

        const capacity = faker.helpers.arrayElement([14, 16, 18, 20]);
        // Skewed toward realistic mid-to-high fill, with some classes near
        // empty and some completely full, matching the fill-variance the
        // hand-seeded rows already show.
        const fillRatio = faker.number.float({ min: 0.2, max: 1, fractionDigits: 2 });
        const bookedCount = Math.min(capacity, Math.round(capacity * fillRatio));

        rows.push({
          id: `class_gen_${dateKey.replaceAll("-", "")}_${instructor.namePrefix.toLowerCase()}_${slotIndex}`,
          name: `${faker.helpers.arrayElement(NAME_VARIANTS)} ${instructor.namePrefix}`,
          type: instructor.classType,
          instructor: instructor.full_name,
          instructor_member_id: memberIdByName.get(instructor.full_name)!,
          class_date: dateKey,
          start_time: startTime,
          duration_minutes: instructor.classType === "Yoga" || instructor.classType === "Pilates" ? 60 : 45,
          capacity,
          booked_count: bookedCount,
        });
      });
    }
  }

  const { error: insertError } = await supabase.from("classes").insert(rows);
  if (insertError) throw insertError;

  console.log(`Generated ${rows.length} classes from ${rangeStart} to ${rangeEnd} (${WEEKS}-week rolling window).`);
  console.log(`Deleted ${deletableIds.length} previously-generated row(s) in this range before regenerating.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
