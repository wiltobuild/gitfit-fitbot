import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type MemberRow = {
  id: string;
  email: string;
  full_name: string | null;
  auth_user_id: string | null;
  lifecycle_status: string;
  is_staff: boolean; is_instructor?: boolean;
  created_at: string;
  fitness_level?: string | null; preferred_class_types?: string | null; last_visit_date?: string | null; membership_tier?: string | null; goals?: string | null; join_date?: string | null;
  cert_tier?: string | null;
};

export type ClassRow = {
  name: string;
  type: string;
  instructor: string;
  class_date: string;
  start_time: string;
  capacity: number;
  booked_count: number;
};

const memberSelect = "id, email, first_name, last_name, full_name, birthdate, phone, auth_user_id, join_date, membership_tier, membership_status, last_visit_date, lifecycle_status, goals, preferred_class_types, fitness_level, is_instructor, cert_tier, created_at";

export async function getMemberForUser(supabase: SupabaseServerClient, authUserId: string) {
  return supabase.from("members").select(memberSelect).eq("auth_user_id", authUserId).maybeSingle();
}

export async function getMemberById(supabase: SupabaseServerClient, memberId: string) {
  return supabase.from("members").select(memberSelect).eq("id", memberId).maybeSingle();
}

export type InstructorOption = { id: string; full_name: string | null };

export async function listInstructors(supabase: SupabaseServerClient) {
  const { data, error } = await supabase.from("members").select("id, full_name").eq("is_instructor", true).order("full_name");
  if (error) throw error;
  return (data ?? []) as InstructorOption[];
}

export async function searchMembers(supabase: SupabaseServerClient, searchTerm: string) {
  const { data, error } = await supabase.rpc("search_members", { search_term: searchTerm });
  return { data: (data ?? []) as MemberRow[], error };
}

export async function listMembersForStaff(supabase: SupabaseServerClient) {
  const { data, error } = await supabase.rpc("list_members_for_staff");
  return { data: (data ?? []) as MemberRow[], error };
}

export async function getMemberLifecycleBreakdown(supabase: SupabaseServerClient) {
  const { data, error } = await listMembersForStaff(supabase);
  if (error) throw error;

  const members = data ?? [];
  const countBy = (values: Array<string | null | undefined>) => {
    const counts: Record<string, number> = {};
    values.forEach((value) => {
      const key = value || "not set";
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return counts;
  };

  return {
    members,
    lifecycleCounts: countBy(members.map((member) => member.lifecycle_status)),
    tierCounts: countBy(members.map((member) => member.membership_tier))
  };
}

export async function getRetentionCandidates(supabase: SupabaseServerClient) {
  const { data: members, error } = await listMembersForStaff(supabase);
  return {
    candidates: members.filter(
      (member) =>
        member.lifecycle_status === "at_risk" ||
        member.lifecycle_status === "lapsed"
    ),
    error
  };
}

export type InstructorMemberRow = { id: string; full_name: string | null; email: string; lifecycle_status: string; last_visit_date: string | null };

// Retention scoped to a trainer's own world: members who've booked at least
// one of their classes, bucketed by lifecycle status. Distinct from
// getMemberLifecycleBreakdown, which is suite-wide (manager-only today).
export async function getMemberRetentionForInstructor(
  supabase: SupabaseServerClient,
  instructorMemberId: string
): Promise<{ members: InstructorMemberRow[]; lifecycleCounts: Record<string, number> }> {
  const { data: classes, error: classError } = await supabase.from("classes").select("id").eq("instructor_member_id", instructorMemberId);
  if (classError) throw classError;
  const classIds = (classes ?? []).map((classRow) => classRow.id);
  if (!classIds.length) return { members: [], lifecycleCounts: {} };

  const { data: bookings, error: bookingError } = await supabase.from("bookings").select("user_id").in("class_id", classIds);
  if (bookingError) throw bookingError;
  const userIds = [...new Set((bookings ?? []).map((booking) => booking.user_id))];
  if (!userIds.length) return { members: [], lifecycleCounts: {} };

  const { data: members, error: memberError } = await supabase
    .from("members")
    .select("id, full_name, email, lifecycle_status, last_visit_date")
    .in("auth_user_id", userIds);
  if (memberError) throw memberError;

  const rows = (members ?? []) as InstructorMemberRow[];
  const lifecycleCounts: Record<string, number> = {};
  for (const member of rows) lifecycleCounts[member.lifecycle_status] = (lifecycleCounts[member.lifecycle_status] ?? 0) + 1;

  return { members: rows, lifecycleCounts };
}

export async function getMemberWeeklyActivity(
  supabase: SupabaseServerClient,
  userId: string
): Promise<{ member: MemberRow; classesThisWeek: number } | null> {
  const { data: member } = await getMemberForUser(supabase, userId);
  if (!member) return null;
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const date = (value: Date) => value.toISOString().slice(0, 10);
  const { data } = await supabase
    .from("bookings")
    .select("id, classes!inner(class_date)")
    .eq("user_id", userId)
    .gte("classes.class_date", date(monday))
    .lte("classes.class_date", date(sunday));

  return { member: member as unknown as MemberRow, classesThisWeek: data?.length ?? 0 };
}

function todayDate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

export async function getUpcomingBookingsForUser(
  supabase: SupabaseServerClient,
  userId: string
) {
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "created_at, classes!inner(name, type, instructor, class_date, start_time, capacity, booked_count)"
    )
    .eq("user_id", userId)
    .gte("classes.class_date", todayDate())
    .order("created_at", { ascending: true });

  if (error) throw error;

  const classes = (data ?? [])
    .map((booking) => booking.classes as unknown as ClassRow | null)
    .filter((classRow): classRow is ClassRow => classRow !== null)
    .sort((a, b) =>
      `${a.class_date} ${a.start_time}`.localeCompare(
        `${b.class_date} ${b.start_time}`
      )
    );

  return classes;
}

export async function getBookingHistoryForUser(
  supabase: SupabaseServerClient,
  userId: string,
  limit = 20
) {
  const { data, error } = await supabase
    .from("bookings")
    .select("created_at, classes!inner(name, type, instructor, class_date, start_time, capacity, booked_count)")
    .eq("user_id", userId)
    .lt("classes.class_date", todayDate())
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? [])
    .map((booking) => booking.classes as unknown as ClassRow | null)
    .filter((classRow): classRow is ClassRow => classRow !== null)
    .sort((a, b) => `${b.class_date} ${b.start_time}`.localeCompare(`${a.class_date} ${a.start_time}`));
}

export async function getMemberStreak(supabase: SupabaseServerClient, userId: string) {
  const today = new Date();
  const mondayOffset = (today.getDay() + 6) % 7;
  const currentWeekMonday = new Date(today);
  currentWeekMonday.setDate(today.getDate() - mondayOffset);
  currentWeekMonday.setHours(0, 0, 0, 0);
  const lookbackMonday = new Date(currentWeekMonday);
  lookbackMonday.setDate(currentWeekMonday.getDate() - 25 * 7);
  const currentWeekKey = formatDateForQuery(currentWeekMonday);
  const currentWeekSunday = new Date(currentWeekMonday);
  currentWeekSunday.setDate(currentWeekMonday.getDate() + 6);

  // Upper bound is the END of the current ISO week, not "today" -- a class
  // booked in advance for later this week must still count toward
  // currentWeekBooked (the week is "secured" the moment it's booked, not
  // only once the class date arrives).
  const { data, error } = await supabase
    .from("bookings")
    .select("classes!inner(class_date)")
    .eq("user_id", userId)
    .gte("classes.class_date", formatDateForQuery(lookbackMonday))
    .lte("classes.class_date", formatDateForQuery(currentWeekSunday));

  if (error) throw error;

  const bookedWeeks = new Set<string>();
  for (const booking of data ?? []) {
    const classDate = (booking.classes as unknown as { class_date: string } | null)?.class_date;
    if (!classDate) continue;
    const date = new Date(`${classDate}T00:00:00`);
    const offset = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - offset);
    bookedWeeks.add(formatDateForQuery(date));
  }

  let streakWeeks = 0;
  const completedWeek = new Date(currentWeekMonday);
  completedWeek.setDate(currentWeekMonday.getDate() - 7);
  while (completedWeek >= lookbackMonday && bookedWeeks.has(formatDateForQuery(completedWeek))) {
    streakWeeks += 1;
    completedWeek.setDate(completedWeek.getDate() - 7);
  }

  return { streakWeeks, currentWeekBooked: bookedWeeks.has(currentWeekKey) };
}

function formatDateForQuery(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export async function searchMembersByAttributes(supabase: SupabaseServerClient, { fitnessLevel, preferredClassType, staleAfterDays, staleBeforeDays }: { fitnessLevel?: string; preferredClassType?: string; staleAfterDays?: number; staleBeforeDays?: number }) { const { data, error } = await supabase.rpc("search_members_by_attributes", { p_fitness_level: fitnessLevel ?? null, p_preferred_class_type: preferredClassType ?? null, p_stale_after_days: staleAfterDays ?? null, p_stale_before_days: staleBeforeDays ?? null }); return { data: (data ?? []) as MemberRow[], error }; }

export async function getCohortMembers(supabase: SupabaseServerClient, { minDays, maxDays }: { minDays: number; maxDays: number }) {
  return searchMembersByAttributes(supabase, { staleAfterDays: minDays, staleBeforeDays: maxDays });
}
