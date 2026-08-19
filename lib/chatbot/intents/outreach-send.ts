import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Intent } from "@/lib/chatbot/types";

type MemberRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
};

type OutreachMessageRow = { id: string };

const sendPattern = /\bsend\s+(?:outreach|the\s+promotion|the\s+message)\s+to\b/i;

function extractSearchTerm(message: string) {
  return message
    .replace(/^\s*(?:please\s+)?send\s+(?:outreach|the\s+promotion|the\s+message)\s+to\b/i, "")
    .replace(/^[\s,.:;!?"']+|[\s,.:;!?"']+$/g, "");
}

function memberLabel(member: MemberRow) {
  return member.full_name || member.email;
}

export const outreachSendIntent: Intent = {
  id: "outreach-send",
  description: "Marks the latest staff-reviewed outreach draft as sent for one member.",
  roles: ["staff"],
  match: (message) => sendPattern.test(message),
  handle: async (message) => {
    const searchTerm = extractSearchTerm(message);
    if (!searchTerm) {
      return { reply: "Please specify a member name or email to send outreach to." };
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("search_members", { search_term: searchTerm });
    const members = (data ?? []) as MemberRow[];

    if (error) {
      console.error("Unable to search members for outreach send", error);
      return { reply: "I couldn’t look up members right now. Please try again shortly." };
    }
    if (members.length === 0) {
      return { reply: `No members found matching '${searchTerm}'.` };
    }
    if (members.length > 1) {
      return { reply: `I found multiple members matching '${searchTerm}'. Please narrow the search:\n${members.map((member) => `${memberLabel(member)} — ${member.email} — ${member.role}`).join("\n")}` };
    }

    const member = members[0];
    const name = memberLabel(member);
    const { data: draftData, error: draftError } = await supabase
      .from("outreach_messages")
      .select("id")
      .eq("target_user_id", member.id)
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (draftError) {
      console.error("Unable to retrieve outreach draft", draftError);
      return { reply: "I couldn’t retrieve that outreach draft right now. Please try again shortly." };
    }
    const draft = draftData as OutreachMessageRow | null;
    if (!draft) {
      return { reply: `There’s no draft outreach for ${name} yet — say 'draft outreach for ${name}' first.` };
    }

    // This only updates GitFit's internal record. No email or SMS provider exists.
    const { error: updateError } = await supabase
      .from("outreach_messages")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", draft.id);

    if (updateError) {
      console.error("Unable to mark outreach as sent", updateError);
      return { reply: "I couldn’t mark that outreach as sent right now. Please try again shortly." };
    }

    return { reply: `Marked the outreach to ${name} as sent.` };
  },
};
