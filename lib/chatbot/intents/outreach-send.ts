import { searchMembers, type MemberRow } from "@/lib/members/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Intent } from "@/lib/chatbot/types";
import { scoreEntity, scoreTriggerFamily } from "@/lib/chatbot/match-scoring";

type OutreachMessageRow = { id: string; body: string; sent_at: string | null };
const sendPattern = /\bsend\s+(?:outreach|the\s+promotion|the\s+message)\s+to\b/i;
function extractSearchTerm(message: string) { return message.replace(/^\s*(?:please\s+)?send\s+(?:outreach|the\s+promotion|the\s+message)\s+to\b/i, "").replace(/^[\s,.:;!?"']+|[\s,.:;!?"']+$/g, ""); }
function memberLabel(member: MemberRow) { return member.full_name || member.email; }

export const outreachSendIntent: Intent = {
  id: "outreach-send", description: "Marks the latest staff-reviewed outreach draft as sent for one member.", roles: ["staff", "admin"], match: (message) => Number(sendPattern.test(message)),
  handle: async (message) => {
    const searchTerm = extractSearchTerm(message);
    if (!searchTerm) return { reply: "Please specify a member name or email to send outreach to." };
    const supabase = await createSupabaseServerClient();
    const { data: members, error } = await searchMembers(supabase, searchTerm);
    if (error) { console.error("Unable to search members for outreach send", error); return { reply: "I couldn't look up members right now. Please try again shortly." }; }
    if (members.length === 0) return { reply: `No members found matching '${searchTerm}'.` };
    if (members.length > 1) return { reply: `I found multiple members matching '${searchTerm}'. Please narrow the search:\n${members.map((member) => `${memberLabel(member)} — ${member.email}`).join("\n")}` };
    const member = members[0]; const name = memberLabel(member);
    const { data: draftData, error: draftError } = await supabase.from("outreach_messages").select("id, body, sent_at").eq("target_member_id", member.id).eq("status", "draft").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (draftError) { console.error("Unable to retrieve outreach draft", draftError); return { reply: "I couldn't retrieve that outreach draft right now. Please try again shortly." }; }
    const draft = draftData as OutreachMessageRow | null;
    if (!draft) return { reply: `There's no draft outreach for ${name} yet — say 'draft outreach for ${name}' first.` };
    const { data: sentData, error: updateError } = await supabase.from("outreach_messages").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", draft.id).select("sent_at").maybeSingle();
    if (updateError) { console.error("Unable to mark outreach as sent", updateError); return { reply: "I couldn't mark that outreach as sent right now. Please try again shortly." }; }
    const sentMessage = sentData as Pick<OutreachMessageRow, "sent_at"> | null;
    return { reply: `Marked the outreach to ${name} as sent.`, card: { kind: "outreach", memberName: name, message: draft.body, sent: true, ...(sentMessage?.sent_at ? { sentAt: sentMessage.sent_at } : {}) } };
  },
};
