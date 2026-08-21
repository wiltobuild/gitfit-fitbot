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

const memberSelect = "id, email, first_name, last_name, full_name, birthdate, phone, auth_user_id, join_date, membership_tier, membership_status, last_visit_date, lifecycle_status, goals, preferred_class_types, fitness_level, is_instructor, created_at";

export async function getMemberForUser(supabase: SupabaseServerClient, authUserId: string) {
  return supabase.from("members").select(memberSelect).eq("auth_user_id", authUserId).maybeSingle();
}

export async function getMemberById(supabase: SupabaseServerClient, memberId: string) {
  return supabase.from("members").select(memberSelect).eq("id", memberId).maybeSingle();
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
export async function searchMembersByAttributes(supabase: SupabaseServerClient, { fitnessLevel, preferredClassType, staleAfterDays, staleBeforeDays }: { fitnessLevel?: string; preferredClassType?: string; staleAfterDays?: number; staleBeforeDays?: number }) { const { data, error } = await supabase.rpc("search_members_by_attributes", { p_fitness_level: fitnessLevel ?? null, p_preferred_class_type: preferredClassType ?? null, p_stale_after_days: staleAfterDays ?? null, p_stale_before_days: staleBeforeDays ?? null }); return { data: (data ?? []) as MemberRow[], error }; }

export async function getCohortMembers(supabase: SupabaseServerClient, { minDays, maxDays }: { minDays: number; maxDays: number }) {
  return searchMembersByAttributes(supabase, { staleAfterDays: minDays, staleBeforeDays: maxDays });
}
