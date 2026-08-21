import { getMemberWeeklyActivity } from "@/lib/members/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Intent, IntentResult } from "@/lib/chatbot/types";
import { scoreEntity, scoreTriggerFamily } from "@/lib/chatbot/match-scoring";
export async function getMemberActivitySummary(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string
): Promise<IntentResult> {
  const activity = await getMemberWeeklyActivity(supabase, userId);
  const member = activity?.member;
  if (!member)
    return { reply: "I don’t have an activity profile on file yet.", card: { kind: "notice", tone: "info", body: "I don’t have an activity profile on file yet." } };
  const data = { length: activity.classesThisWeek };
  const body = `You’ve booked ${data?.length ?? 0} classes this week (aim for 4). Your last visit was ${member.last_visit_date ?? "not recorded"}; you’ve been a ${member.membership_tier ?? "member"} tier member since ${member.join_date ?? "your join date isn’t recorded"}.`;
  return { reply: "Here’s your activity summary.", card: { kind: "notice", tone: "info", title: "Your activity", body } };
}
export const myActivityIntent: Intent = {
  id: "my-activity",
  description: "Summarizes the current member's activity.",
  roles: ["client"],
  match: (message) =>
    scoreTriggerFamily(message, [
      /\b(when did i last visit|how am i doing|my activity|how active have i been)\b/i
    ]) *
    (1 + scoreEntity(message, [])),
  handle: async (_message, session, pendingAnswer) => {
    void pendingAnswer;
    return getMemberActivitySummary(
      await createSupabaseServerClient(),
      session.user.id
    );
  }
};
