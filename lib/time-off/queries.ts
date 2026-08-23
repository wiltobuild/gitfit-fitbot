import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type PendingTimeOffRequest = {
  id: string;
  requested_date: string;
  reason: string | null;
  created_at: string;
  full_name: string | null;
};

// auth.users is not exposed as a relationship to the browser/server JS client.
// Profiles contain the display name needed by this dashboard, so fetch them in a
// second query (the same pattern used by the existing pending-time-off chatbot chip).
export async function listPendingTimeOffRequests(supabase: SupabaseServerClient) {
  const { data: requests, error } = await supabase
    .from("time_off_requests")
    .select("id, user_id, requested_date, reason, created_at")
    .eq("status", "pending")
    .order("requested_date");
  if (error) throw error;

  const userIds = [...new Set((requests ?? []).map((request) => request.user_id))];
  let nameByUser = new Map<string, string | null>();
  if (userIds.length) {
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);
    if (profileError) throw profileError;
    nameByUser = new Map(
      (profiles ?? []).map((profile) => [profile.id, profile.full_name])
    );
  }

  return (requests ?? []).map((request) => ({
    id: request.id,
    requested_date: request.requested_date,
    reason: request.reason,
    created_at: request.created_at,
    full_name: nameByUser.get(request.user_id) ?? null
  })) as PendingTimeOffRequest[];
}

export async function getPendingTimeOffCount(supabase: SupabaseServerClient) {
  const { count, error } = await supabase
    .from("time_off_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) throw error;
  return count ?? 0;
}
