import { searchMembers, type MemberRow } from "@/lib/members/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Intent } from "@/lib/chatbot/types";
import { scoreEntity, scoreTriggerFamily } from "@/lib/chatbot/match-scoring";

const draftPattern = /\b(?:draft\s+(?:outreach|a\s+message|promotion)\s+for|prepare\s+outreach\s+for|write\s+something\s+to\s+win\s+back)\b/i;
function extractSearchTerm(message: string) { return message.replace(/^\s*(?:please\s+)?(?:draft\s+(?:outreach|a\s+message|promotion)\s+for|prepare\s+outreach\s+for)\b/i, "").replace(/^\s*(?:can|could)\s+you\s+write\s+something\s+to\s+win\s+back\b/i, "").replace(/^[\s,.:;!?"']+|[\s,.:;!?"']+$/g, ""); }
function memberLabel(member: MemberRow) { return member.full_name || member.email; }

export const outreachDraftIntent: Intent = {
  id: "outreach-draft", description: "Creates a staff-reviewed outreach draft for one member.", roles: ["staff", "admin"], match: (message) => scoreTriggerFamily(message, [draftPattern]) * (1 + scoreEntity(message, [/\b(?:for|back)\s+[a-z]+\b/i])),
  handle: async (message, session) => {
    const searchTerm = extractSearchTerm(message);
    if (!searchTerm) return { reply: "Please specify a member name or email for the outreach draft." };
    const supabase = await createSupabaseServerClient();
    const { data: members, error } = await searchMembers(supabase, searchTerm);
    if (error) { console.error("Unable to search members for outreach draft", error); return { reply: "I couldn't look up members right now. Please try again shortly." }; }
    if (members.length === 0) return { reply: `No members found matching '${searchTerm}'.` };
    if (members.length > 1) return { reply: `I found multiple members matching '${searchTerm}'. Please narrow the search:\n${members.map((member) => `${memberLabel(member)} — ${member.email}`).join("\n")}` };
    const member = members[0]; const name = memberLabel(member); const subject = "We miss you at GitFit!";
    const body = `Hi ${name}, it's been a while since we've seen you at GitFit — we'd love to have you back. Check the schedule and book a class that feels right for you. Let us know if there's anything we can do to help you get back on track.`;
    const { error: insertError } = await supabase.from("outreach_messages").insert({ target_member_id: member.id, staff_user_id: session.user.id, subject, body });
    if (insertError) { console.error("Unable to create outreach draft", insertError); return { reply: "I couldn't create that outreach draft right now. Please try again shortly." }; }
    return { reply: `Subject: ${subject}\n\n${body}\n\nThis is only a draft — nothing has been sent. Say 'send outreach to ${name}' to send it.`, card: { kind: "outreach", memberName: name, message: `${subject}\n\n${body}`, sent: false } };
  },
};
