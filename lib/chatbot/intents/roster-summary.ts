import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMemberLifecycleBreakdown, type MemberRow } from "@/lib/members/queries";
import type { Intent } from "@/lib/chatbot/types";
import { scoreEntity, scoreTriggerFamily } from "@/lib/chatbot/match-scoring";
function breakdown(counts: Record<string, number>) {
  return Object.entries(counts)
    .map(([key, count]) => `${count} ${key}`)
    .join(", ");
}
export async function getRosterSummary() {
  const supabase = await createSupabaseServerClient();
  let members: MemberRow[];
  let lifecycleCounts: Record<string, number>;
  let tierCounts: Record<string, number>;
  try {
    ({ members, lifecycleCounts, tierCounts } = await getMemberLifecycleBreakdown(supabase));
  } catch {
    return {
      reply:
        "I couldn't retrieve the roster right now. Please try again shortly."
    };
  }
  const attention = members
    .filter((member) => ["at_risk", "lapsed"].includes(member.lifecycle_status))
    .slice(0, 8);
  return {
    reply: `Roster summary: ${breakdown(lifecycleCounts)}. Membership tiers: ${breakdown(tierCounts)}.`,
    card: {
      kind: "members" as const,
      title: "Members needing attention",
      members: (attention.length ? attention : members.slice(0, 8)).map(
        (member) => ({
          name: member.full_name || member.email,
          email: member.email,
          status: member.lifecycle_status,
          reason: `Membership tier: ${member.membership_tier ?? "not set"}`
        })
      )
    }
  };
}
export const rosterSummaryIntent: Intent = {
  id: "roster-summary",
  description: "Summarizes roster lifecycle and membership tiers.",
  roles: ["staff", "admin"],
  match: (message) =>
    scoreTriggerFamily(message, [
      /\b(roster summary|member summary|membership breakdown)\b/i
    ]) *
    (1 +
      scoreEntity(message, [
        /\b(lifecycle|at[ -]?risk|lapsed|membership tiers?)\b/i
      ])),
  handle: async (_message, _session, pendingAnswer) => {
    void pendingAnswer;
    return getRosterSummary();
  }
};
