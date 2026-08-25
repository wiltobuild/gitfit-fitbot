import { resolveClassType } from "@/lib/chatbot/entity-extraction";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type StudioClass = {
  id: string;
  name: string;
  type: string;
  instructor: string;
  class_date: string;
  start_time: string;
  duration_minutes: number;
  capacity: number;
  booked_count: number;
  instructor_member_id: string | null;
  promoted: boolean;
};

const classSelect =
  "id, name, type, instructor, class_date, start_time, duration_minutes, capacity, booked_count, instructor_member_id, promoted";

export async function getUpcomingClasses(
  supabase: SupabaseServerClient,
  { from, to }: { from: string; to: string }
) {
  const { data, error } = await supabase
    .from("classes")
    .select(classSelect)
    .gte("class_date", from)
    .lte("class_date", to)
    .order("class_date")
    .order("start_time");

  if (error) throw error;
  return (data ?? []) as StudioClass[];
}

export async function getClassesForMonth(
  supabase: SupabaseServerClient,
  year: number,
  month: number
) {
  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0);
  const finalDay = `${year}-${String(month).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;
  return getUpcomingClasses(supabase, { from: firstDay, to: finalDay });
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export async function getClassesForInstructor(
  supabase: SupabaseServerClient,
  memberId: string
) {
  const today = new Date();
  const { data, error } = await supabase
    .from("classes")
    .select(classSelect)
    .eq("instructor_member_id", memberId)
    .gte("class_date", formatDate(today))
    .order("class_date")
    .order("start_time");

  if (error) throw error;
  return (data ?? []) as StudioClass[];
}

export async function getClassesForInstructorInRange(
  supabase: SupabaseServerClient,
  memberId: string,
  { from, to }: { from: string; to: string }
) {
  const { data, error } = await supabase
    .from("classes")
    .select(classSelect)
    .eq("instructor_member_id", memberId)
    .gte("class_date", from)
    .lte("class_date", to)
    .order("class_date")
    .order("start_time");

  if (error) throw error;
  return (data ?? []) as StudioClass[];
}

export type InstructorLeaderboardRow = {
  instructorMemberId: string;
  instructorName: string;
  classCount: number;
  totalCapacity: number;
  totalBooked: number;
  fillRatePercent: number;
  uniqueMembers: number;
};

// "Staff retention" per the product's definition: which instructors keep
// members coming back, measured as unique members served (breadth) and fill
// rate (demand), not employment tenure.
export async function getInstructorLeaderboard(
  supabase: SupabaseServerClient,
  { from, to }: { from: string; to: string }
): Promise<InstructorLeaderboardRow[]> {
  const { data: classes, error } = await supabase
    .from("classes")
    .select("id, instructor, instructor_member_id, capacity, booked_count")
    .gte("class_date", from)
    .lte("class_date", to)
    .not("instructor_member_id", "is", null);
  if (error) throw error;

  const classRows = classes ?? [];
  const classIds = classRows.map((classRow) => classRow.id);

  const { data: bookings, error: bookingError } = classIds.length
    ? await supabase.from("bookings").select("class_id, user_id").in("class_id", classIds)
    : { data: [] as { class_id: string; user_id: string }[], error: null };
  if (bookingError) throw bookingError;

  const membersByClass = new Map<string, Set<string>>();
  for (const booking of bookings ?? []) {
    if (!membersByClass.has(booking.class_id)) membersByClass.set(booking.class_id, new Set());
    membersByClass.get(booking.class_id)!.add(booking.user_id);
  }

  const byInstructor = new Map<string, { name: string; classCount: number; totalCapacity: number; totalBooked: number; members: Set<string> }>();
  for (const classRow of classRows) {
    const instructorMemberId = classRow.instructor_member_id as string;
    if (!byInstructor.has(instructorMemberId)) {
      byInstructor.set(instructorMemberId, { name: classRow.instructor, classCount: 0, totalCapacity: 0, totalBooked: 0, members: new Set() });
    }
    const entry = byInstructor.get(instructorMemberId)!;
    entry.classCount += 1;
    entry.totalCapacity += classRow.capacity;
    entry.totalBooked += classRow.booked_count;
    for (const userId of membersByClass.get(classRow.id) ?? []) entry.members.add(userId);
  }

  return [...byInstructor.entries()]
    .map(([instructorMemberId, entry]) => ({
      instructorMemberId,
      instructorName: entry.name,
      classCount: entry.classCount,
      totalCapacity: entry.totalCapacity,
      totalBooked: entry.totalBooked,
      fillRatePercent: entry.totalCapacity ? Math.round((entry.totalBooked / entry.totalCapacity) * 100) : 0,
      uniqueMembers: entry.members.size
    }))
    .sort((a, b) => b.uniqueMembers - a.uniqueMembers || b.fillRatePercent - a.fillRatePercent);
}

export async function getInstructorBookingRateTrend(
  supabase: SupabaseServerClient,
  memberId: string
): Promise<{ thisWeekFillPercent: number; lastWeekFillPercent: number }> {
  const today = new Date();
  const mondayOffset = (today.getDay() + 6) % 7;
  const thisWeekMonday = new Date(today);
  thisWeekMonday.setDate(today.getDate() - mondayOffset);
  thisWeekMonday.setHours(0, 0, 0, 0);
  const thisWeekSunday = new Date(thisWeekMonday);
  thisWeekSunday.setDate(thisWeekMonday.getDate() + 6);
  const lastWeekMonday = new Date(thisWeekMonday);
  lastWeekMonday.setDate(thisWeekMonday.getDate() - 7);
  const lastWeekSunday = new Date(thisWeekMonday);
  lastWeekSunday.setDate(thisWeekMonday.getDate() - 1);

  const { data, error } = await supabase
    .from("classes")
    .select("class_date, booked_count, capacity")
    .eq("instructor_member_id", memberId)
    .gte("class_date", formatDate(lastWeekMonday))
    .lte("class_date", formatDate(thisWeekSunday));

  if (error) throw error;

  const fillPercent = (from: Date, to: Date) => {
    const classes = (data ?? []).filter((classRow) => classRow.class_date >= formatDate(from) && classRow.class_date <= formatDate(to));
    const capacity = classes.reduce((total, classRow) => total + classRow.capacity, 0);
    const booked = classes.reduce((total, classRow) => total + classRow.booked_count, 0);
    return capacity ? Math.round((booked / capacity) * 100) : 0;
  };

  return {
    thisWeekFillPercent: fillPercent(thisWeekMonday, thisWeekSunday),
    lastWeekFillPercent: fillPercent(lastWeekMonday, lastWeekSunday)
  };
}

// Shared with lib/chatbot/intents/recommend-class.ts, which called this
// query inline before it was extracted here -- same real "classes matching
// this member's preferred_class_types" source of truth for both the
// chatbot's "what should I book?" reply and the client dashboard's
// recommendations, instead of two copies of the same matching logic.
export async function getRecommendedClassesForMember(
  supabase: SupabaseServerClient,
  member: { preferred_class_types?: string | null }
): Promise<{ preferredTypes: Array<"yoga" | "cycling" | "hiit">; classes: StudioClass[] }> {
  const preferredTypes = [
    ...new Set(
      (member.preferred_class_types ?? "")
        .split(";")
        .map((value) => resolveClassType(value.trim()))
        .filter((type): type is "yoga" | "cycling" | "hiit" => Boolean(type))
    )
  ];
  if (!preferredTypes.length) return { preferredTypes: [], classes: [] };

  const classTypes = preferredTypes.map((type) => (type === "hiit" ? "HIIT" : `${type[0].toUpperCase()}${type.slice(1)}`));
  const today = new Date();
  const { data, error } = await supabase
    .from("classes")
    .select(classSelect)
    .gte("class_date", formatDate(today))
    .in("type", classTypes)
    .order("class_date")
    .order("start_time")
    .limit(5);
  if (error) throw error;
  return { preferredTypes, classes: (data ?? []) as StudioClass[] };
}

export type ClassInput = {
  name: string;
  type: string;
  instructorMemberId: string;
  instructorName: string;
  classDate: string;
  startTime: string;
  durationMinutes: number;
  capacity: number;
};

export async function createClass(supabase: SupabaseServerClient, input: ClassInput) {
  const id = `class_${crypto.randomUUID()}`;
  const { error } = await supabase.from("classes").insert({
    id,
    name: input.name,
    type: input.type,
    instructor: input.instructorName,
    instructor_member_id: input.instructorMemberId,
    class_date: input.classDate,
    start_time: input.startTime,
    duration_minutes: input.durationMinutes,
    capacity: input.capacity
  });
  if (error) throw error;
  return id;
}

export async function updateClass(supabase: SupabaseServerClient, classId: string, input: ClassInput) {
  const { error } = await supabase
    .from("classes")
    .update({
      name: input.name,
      type: input.type,
      instructor: input.instructorName,
      instructor_member_id: input.instructorMemberId,
      class_date: input.classDate,
      start_time: input.startTime,
      duration_minutes: input.durationMinutes,
      capacity: input.capacity
    })
    .eq("id", classId);
  if (error) throw error;
}

export async function deleteClass(supabase: SupabaseServerClient, classId: string) {
  const { error } = await supabase.from("classes").delete().eq("id", classId);
  if (error) throw error;
}

export async function setClassPromoted(supabase: SupabaseServerClient, classId: string, promoted: boolean) {
  const { error } = await supabase.from("classes").update({ promoted }).eq("id", classId);
  if (error) throw error;
}
