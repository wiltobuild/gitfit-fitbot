import type { createSupabaseServerClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type ResolveResult = { ok: true } | { ok: false; code: "not_found"; message: string };

export async function resolveTimeOffRequest(
  supabase: Supabase,
  { requestId, decision, reviewerId }: { requestId: string; decision: "approved" | "denied"; reviewerId: string },
): Promise<ResolveResult> {
  // RLS's time_off_requests_update_admin policy is the real gate — this
  // .eq("status", "pending") is an application-level safeguard against a
  // double-resolve race, not the security boundary.
  const { data, error } = await supabase
    .from("time_off_requests")
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
