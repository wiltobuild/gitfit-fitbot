import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type ClassChangeRequest = {
  id: string;
  class_id: string;
  user_id: string;
  type: "swap" | "cancel";
  swap_with_member_id: string | null;
  reason: string | null;
  status: "pending" | "approved" | "denied";
  created_at: string;
  reviewed_at: string | null;
};

export async function listOwnClassChangeRequests(supabase: SupabaseServerClient, userId: string) {
  const { data, error } = await supabase
    .from("class_change_requests")
    .select("id, class_id, user_id, type, swap_with_member_id, reason, status, created_at, reviewed_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ClassChangeRequest[];
}

export async function listPendingClassChangeRequests(supabase: SupabaseServerClient) {
  const { data, error } = await supabase
    .from("class_change_requests")
    .select("id, class_id, user_id, type, swap_with_member_id, reason, status, created_at, reviewed_at")
    .eq("status", "pending")
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as ClassChangeRequest[];
}

export async function submitClassChangeRequest(
  supabase: SupabaseServerClient,
  { classId, userId, type, reason }: { classId: string; userId: string; type: "swap" | "cancel"; reason: string | null }
) {
  const { error } = await supabase.from("class_change_requests").insert({ class_id: classId, user_id: userId, type, reason });
  if (error) throw error;
}

export type ResolveResult = { ok: true } | { ok: false; code: "not_found"; message: string };

export async function resolveClassChangeRequest(
  supabase: SupabaseServerClient,
  { requestId, decision, reviewerId }: { requestId: string; decision: "approved" | "denied"; reviewerId: string }
): Promise<ResolveResult> {
  // RLS's class_change_requests_update_admin policy is the real gate -- this
  // .eq("status", "pending") is an application-level safeguard against a
  // double-resolve race, matching lib/staff/time-off.ts's convention.
  const { data, error } = await supabase
    .from("class_change_requests")
    .update({ status: decision, reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id");

  if (error) throw error;
  if (!data?.length) {
    return { ok: false, code: "not_found", message: "That request is no longer pending, or does not exist." };
  }
  return { ok: true };
}

/**
 * When a class is deleted, any still-pending swap/cancel requests against it
 * can never be resolved by a member action -- auto-deny them so they don't
 * sit forever in the manager queue pointing at a class that no longer exists.
 */
export async function denyPendingRequestsForCanceledClass(
  supabase: SupabaseServerClient,
  { classId, reviewerId }: { classId: string; reviewerId: string }
): Promise<number> {
  const { data, error } = await supabase
    .from("class_change_requests")
    .update({
      status: "denied",
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      reason: "Class was canceled."
    })
    .eq("class_id", classId)
    .eq("status", "pending")
    .select("id");

  if (error) throw error;
  return data?.length ?? 0;
}
