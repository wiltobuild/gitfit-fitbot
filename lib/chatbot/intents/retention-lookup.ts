import { listMembersForStaff } from "@/lib/members/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Intent } from "@/lib/chatbot/types";

const retentionPatterns = [/\bwho\s+hasn['’]?t\s+attended\b/i, /\battendance\s+dropped\b/i, /\bwho\s+needs\s+re-engagement\b/i, /\bwho\s+hasn['’]?t\s+been\b/i, /\binactive\s+members\b/i, /\bhaven['’]?t\s+attended\s+recently\b/i];

export const retentionLookupIntent: Intent = {
  id: "retention-lookup", description: "Finds members needing re-engagement based on lifecycle status.", roles: ["staff"], match: (message) => retentionPatterns.some((pattern) => pattern.test(message)),
  handle: async () => {
    const supabase = await createSupabaseServerClient();
    const { data: members, error } = await listMembersForStaff(supabase);
    if (error) { console.error("Unable to look up retention candidates", error); return { reply: "I couldn't retrieve member lifecycle data right now. Please try again shortly." }; }
    const candidates = members.filter((member) => member.lifecycle_status === "at_risk" || member.lifecycle_status === "lapsed");
    const caveat = "Based on lifecycle status, these members need re-engagement:";
    if (candidates.length === 0) return { reply: `${caveat}\nNone found.` };
    return { reply: `${caveat}\n${candidates.map((member) => member.full_name || member.email).join("\n")}`, card: { kind: "members", title: "Members needing re-engagement", members: candidates.map((member) => ({ name: member.full_name || member.email, email: member.email, status: member.lifecycle_status, reason: `Lifecycle status: ${member.lifecycle_status}` })) } };
  },
};
