import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// Bulk campaign bodies are stored as a reusable "[First name]" template
// (one row per recipient, one shared body) — resolve it wherever a stored
// outreach body is shown to or delivered for a specific real member.
export function personalizeOutreachBody(body: string, fullName: string | null | undefined) {
  const firstName = fullName?.trim().split(/\s+/)[0] || "there";
  return body.replaceAll("[First name]", firstName);
}

export async function createBulkOutreachDrafts(supabase: SupabaseServerClient, { memberIds, subject, body, staffUserId }: { memberIds: string[]; subject: string; body: string; staffUserId: string }) {
  if (memberIds.length === 0) return { data: [], error: null };
  return supabase.from("outreach_messages").insert(memberIds.map((memberId) => ({ target_member_id: memberId, staff_user_id: staffUserId, subject, body, status: "draft" }))).select();
}

type OutreachDraftRow = {
  id: string;
  body: string;
  target_member_id: string;
  members: { auth_user_id: string | null; full_name: string | null } | null;
};

export async function sendOutreachDraft(supabase: SupabaseServerClient, draftId: string) {
  const alreadySentMessage = "This draft has already been sent or no longer exists.";
  const { data: draftData, error: draftError } = await supabase
    .from("outreach_messages")
    .select("id, body, target_member_id, members!inner(auth_user_id, full_name)")
    .eq("id", draftId)
    .eq("status", "draft")
    .maybeSingle();

  if (draftError) {
    console.error("Unable to retrieve outreach draft", draftError);
    return { ok: false as const, message: "Unable to retrieve this outreach draft." };
  }

  const draft = draftData as OutreachDraftRow | null;
  if (!draft) return { ok: false as const, message: alreadySentMessage };

  const personalizedBody = personalizeOutreachBody(draft.body, draft.members?.full_name);
  const { data: sentData, error: updateError } = await supabase
    .from("outreach_messages")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", draftId)
    .eq("status", "draft")
    .select("sent_at")
    .maybeSingle();

  if (updateError) {
    console.error("Unable to mark outreach as sent", updateError);
    return { ok: false as const, message: "Unable to mark this outreach as sent." };
  }

  const sentAt = (sentData as { sent_at: string | null } | null)?.sent_at;
  if (!sentAt) return { ok: false as const, message: alreadySentMessage };

  if (draft.members?.auth_user_id) {
    const { error: deliveryError } = await supabase
      .from("chat_messages")
      .insert({
        user_id: draft.members.auth_user_id,
        role: "assistant",
        content: personalizedBody,
        is_promotional: true
      });
    if (deliveryError) {
      console.error("Unable to deliver outreach to FitBot", deliveryError);
    }
  }

  return { ok: true as const, sentAt };
}

export async function getMemberPromotions(supabase: SupabaseServerClient, memberId: string) {
  return supabase.from("outreach_messages").select("id, subject, body, sent_at").eq("target_member_id", memberId).eq("status", "sent").order("sent_at", { ascending: false });
}
