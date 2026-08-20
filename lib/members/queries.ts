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
export async function searchMembersByAttributes(supabase: SupabaseServerClient, { fitnessLevel, preferredClassType, staleAfterDays }: { fitnessLevel?: string; preferredClassType?: string; staleAfterDays?: number }) { const { data, error } = await supabase.rpc("search_members_by_attributes", { p_fitness_level: fitnessLevel ?? null, p_preferred_class_type: preferredClassType ?? null, p_stale_after_days: staleAfterDays ?? null }); return { data: (data ?? []) as MemberRow[], error }; }
