import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export async function createBulkOutreachDrafts(supabase: SupabaseServerClient, { memberIds, subject, body, staffUserId }: { memberIds: string[]; subject: string; body: string; staffUserId: string }) {
  if (memberIds.length === 0) return { data: [], error: null };
  return supabase.from("outreach_messages").insert(memberIds.map((memberId) => ({ target_member_id: memberId, staff_user_id: staffUserId, subject, body, status: "draft" }))).select();
}

export async function getMemberPromotions(supabase: SupabaseServerClient, memberId: string) {
  return supabase.from("outreach_messages").select("id, subject, body, sent_at").eq("target_member_id", memberId).eq("status", "sent").order("sent_at", { ascending: false });
}
