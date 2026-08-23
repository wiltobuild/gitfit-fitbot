// Backfills 8 weeks of PAST studio classes and real member bookings, so
// activity-trend charts (e.g. the retention page's weekly active-members
// graph, which reads bookings.created_at) show genuine week-to-week history
// instead of a single spike in the week this dataset was first seeded.
//
// Idempotent and safe to re-run: generated classes use the distinguishable
// ID namespace `class_hist_<YYYYMMDD>_<slot>` (never overlapping the
// hand-seeded class_001-029 rows or seed-classes.ts's class_gen_* rows).
// Re-running deletes and regenerates only its own namespace's classes for
// the target range, refusing to touch any that already have real bookings
// (same safety rule as seed-classes.ts). Bookings rely on the DB's own
// unique(class_id, user_id) constraint to no-op safely on a re-run.
//
// Run with: npx tsx supabase/seed/seed-historical-activity.ts
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

const WEEKS_BACK = 8;
const WEEKDAY_SLOT_TIMES = ["07:00", "12:00", "17:30"];
const WEEKEND_SLOT_TIMES = ["09:00", "10:30"];
const NAME_VARIANTS = ["Morning", "Midday", "Evening", "Power", "Restorative", "Express", "Deep", "Core"];

type Instructor = { full_name: string; classType: string; namePrefix: string };
const INSTRUCTORS: Instructor[] = [
  { full_name: "Sofia Martinez", classType: "Yoga", namePrefix: "Flow" },
  { full_name: "Marcus Lee", classType: "Cycling", namePrefix: "Ride" },
  { full_name: "Avery Thompson", classType: "HIIT", namePrefix: "Circuit" },
  { full_name: "Diego Reyes", classType: "Boxing", namePrefix: "Boxing" },
  { full_name: "Elena Cruz", classType: "Pilates", namePrefix: "Pilates" },
  { full_name: "Jordan Blake", classType: "Strength", namePrefix: "Strength" },
];

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
  const { data: earliestRows, error: earliestError } = await supabase
    .from("classes")
    .select("class_date")
    .not("id", "like", "class_hist_%")
    .order("class_date", { ascending: true })
    .limit(1);
  if (earliestError) throw earliestError;
  const earliestExisting = earliestRows?.[0]?.class_date;
  if (!earliestExisting) throw new Error("No existing non-historical classes found -- run seed-classes.ts first.");

  const rangeEndDate = new Date(`${earliestExisting}T00:00:00`);
  rangeEndDate.setDate(rangeEndDate.getDate() - 1); // day before the earliest existing class
  const rangeEndMonday = mondayOf(rangeEndDate);
  const rangeStartMonday = new Date(rangeEndMonday);
  rangeStartMonday.setDate(rangeEndMonday.getDate() - (WEEKS_BACK - 1) * 7);
  const days = WEEKS_BACK * 7;
  const rangeStart = dateString(rangeStartMonday);
  const rangeEndOfWeek = new Date(rangeEndMonday);
  rangeEndOfWeek.setDate(rangeEndMonday.getDate() + 6);
  const rangeEnd = dateString(rangeEndOfWeek);

  faker.seed(19700101); // fixed seed -- reproducible, distinct from seed-classes.ts's run-date-keyed seed since this is a one-time historical fill, not a rolling window

  const { data: members, error: memberError } = await supabase
    .from("members")
    .select("id, full_name, auth_user_id, is_instructor")
    .not("auth_user_id", "is", null);
  if (memberError) throw memberError;

  const instructorMemberIdByName = new Map(members.filter((m) => m.is_instructor).map((m) => [m.full_name, m.id as string]));
  for (const instructor of INSTRUCTORS) {
    if (!instructorMemberIdByName.has(instructor.full_name)) {
      throw new Error(`No members row found for instructor "${instructor.full_name}" -- run seed-members.ts / seed-new-instructors.ts first.`);
    }
  }
  const bookableAuthUserIds = members.filter((m) => !m.is_instructor).map((m) => m.auth_user_id as string);
  if (bookableAuthUserIds.length === 0) throw new Error("No non-instructor account-holder members found to book historical classes.");

  // Safety: refuse to touch any of our own previously-generated historical
  // rows that already have real bookings.
  const { data: existingHistorical, error: existingError } = await supabase
    .from("classes")
    .select("id, booked_count")
    .like("id", "class_hist_%")
    .gte("class_date", rangeStart)
    .lte("class_date", rangeEnd);
  if (existingError) throw existingError;
  const bookedExisting = (existingHistorical ?? []).filter((row) => row.booked_count > 0);
  if (bookedExisting.length > 0) {
    throw new Error(
      `Refusing to regenerate: ${bookedExisting.length} previously-generated historical class(es) already have real bookings ` +
      `(e.g. ${bookedExisting[0].id}, booked_count=${bookedExisting[0].booked_count}). Resolve manually before re-running.`
    );
  }
  const deletableIds = (existingHistorical ?? []).map((row) => row.id);
  if (deletableIds.length > 0) {
    const { error: deleteError } = await supabase.from("classes").delete().in("id", deletableIds);
    if (deleteError) throw deleteError;
  }

  const classRows: Array<{
    id: string; name: string; type: string; instructor: string; instructor_member_id: string;
    class_date: string; start_time: string; duration_minutes: number; capacity: number;
  }> = [];
  const classesByWeek = new Map<string, typeof classRows>();

  for (let dayOffset = 0; dayOffset < days; dayOffset++) {
    const day = new Date(rangeStartMonday);
    day.setDate(rangeStartMonday.getDate() + dayOffset);
    const dayOfWeek = day.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const slotTimes = isWeekend ? WEEKEND_SLOT_TIMES : WEEKDAY_SLOT_TIMES;
    const dateKey = dateString(day);
    const weekKey = dateString(mondayOf(day));

    for (const instructor of INSTRUCTORS) {
      slotTimes.forEach((startTime, slotIndex) => {
        const skipChance = isWeekend ? 0.34 : 0.25;
        if (faker.number.float({ min: 0, max: 1 }) < skipChance) return;
        const capacity = faker.helpers.arrayElement([14, 16, 18, 20]);
        const row = {
          id: `class_hist_${dateKey.replaceAll("-", "")}_${instructor.namePrefix.toLowerCase()}_${slotIndex}`,
          name: `${faker.helpers.arrayElement(NAME_VARIANTS)} ${instructor.namePrefix}`,
          type: instructor.classType,
          instructor: instructor.full_name,
          instructor_member_id: instructorMemberIdByName.get(instructor.full_name)!,
          class_date: dateKey,
          start_time: startTime,
          duration_minutes: instructor.classType === "Yoga" || instructor.classType === "Pilates" ? 60 : 45,
          capacity,
        };
        classRows.push(row);
        (classesByWeek.get(weekKey) ?? classesByWeek.set(weekKey, []).get(weekKey)!).push(row);
      });
    }
  }

  const { error: insertClassesError } = await supabase.from("classes").insert(classRows);
  if (insertClassesError) throw insertClassesError;
  console.log(`Generated ${classRows.length} historical classes from ${rangeStart} to ${rangeEnd} (${WEEKS_BACK} weeks).`);

  // Real bookings, spread across each week, so weekly active-member counts
  // vary realistically instead of all clustering on one insert timestamp.
  let bookingsInserted = 0;
  let bookingsSkipped = 0;
  for (const [, weekClasses] of classesByWeek.entries()) {
    if (weekClasses.length === 0) continue;
    const activeMemberCount = faker.number.int({ min: Math.floor(bookableAuthUserIds.length * 0.4), max: Math.floor(bookableAuthUserIds.length * 0.75) });
    const activeMembers = faker.helpers.arrayElements(bookableAuthUserIds, activeMemberCount);

    for (const authUserId of activeMembers) {
      const bookingsThisWeek = faker.number.int({ min: 1, max: 3 });
      const chosenClasses = faker.helpers.arrayElements(weekClasses, Math.min(bookingsThisWeek, weekClasses.length));
      for (const classRow of chosenClasses) {
        const classDate = new Date(`${classRow.class_date}T00:00:00`);
        const daysBefore = faker.number.int({ min: 0, max: 4 });
        const createdAt = new Date(classDate);
        createdAt.setDate(classDate.getDate() - daysBefore);
        createdAt.setHours(faker.number.int({ min: 7, max: 21 }), faker.number.int({ min: 0, max: 59 }), 0, 0);
        // Never backdate before the start of the historical window itself.
        if (createdAt < rangeStartMonday) createdAt.setTime(rangeStartMonday.getTime());

        const { error: bookingError } = await supabase
          .from("bookings")
          .insert({ class_id: classRow.id, user_id: authUserId, created_at: createdAt.toISOString() });
        if (bookingError) {
          // Unique-violation (already booked) or capacity-exceeded are both
          // expected, safe no-ops on a re-run or a tightly-packed week.
          bookingsSkipped += 1;
          continue;
        }
        bookingsInserted += 1;
      }
    }
  }

  console.log(`Inserted ${bookingsInserted} historical bookings (${bookingsSkipped} skipped as duplicate/full).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
