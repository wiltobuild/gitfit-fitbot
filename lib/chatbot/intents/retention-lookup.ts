import { getRetentionCandidates } from "@/lib/members/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Intent } from "@/lib/chatbot/types";
import { scoreEntity, scoreTriggerFamily } from "@/lib/chatbot/match-scoring";

const retentionPatterns = [
  /\bwho\s+hasn['’]?t\s+attended\b/i,
  /\battendance\s+dropped\b/i,
  /\bwho\s+needs\s+re-engagement\b/i,
  /\bwho\s+hasn['’]?t\s+been\b/i,
  /\binactive\s+members\b/i,
  /\bhaven['’]?t\s+attended\s+recently\b/i
];
export { getRetentionCandidates } from "@/lib/members/queries";
export const retentionLookupIntent: Intent = {
  id: "retention-lookup",
  description: "Finds members needing re-engagement based on lifecycle status.",
  roles: ["staff", "admin"],
  match: (message) =>
    scoreTriggerFamily(message, retentionPatterns) *
    (1 + scoreEntity(message, [/\b(at[ -]?risk|lapsed|lifecycle status)\b/i])),
  handle: async (_message, _session, pendingAnswer) => {
    void pendingAnswer;
    const supabase = await createSupabaseServerClient();
    const { candidates, error } = await getRetentionCandidates(supabase);
    if (error) {
      console.error("Unable to look up retention candidates", error);
      return {
        reply:
          "I couldn't retrieve member lifecycle data right now. Please try again shortly."
      };
    }
    const caveat =
      "Based on lifecycle status, these members need re-engagement:";
    if (candidates.length === 0) return { reply: `${caveat}\nNone found.` };
    return {
      reply: `${caveat}\n${candidates.map((member) => member.full_name || member.email).join("\n")}`,
      card: {
        kind: "members",
        title: "Members needing re-engagement",
        members: candidates.map((member) => ({
          name: member.full_name || member.email,
          email: member.email,
          status: member.lifecycle_status,
          reason: `Lifecycle status: ${member.lifecycle_status}`
        }))
      }
    };
  }
};
