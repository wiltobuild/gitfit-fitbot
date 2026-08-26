import { resolveClassType } from "@/lib/chatbot/entity-extraction";
import { scoreEntity, scoreTriggerFamily } from "@/lib/chatbot/match-scoring";
import type { Intent } from "@/lib/chatbot/types";
import { searchMembersByAttributes } from "@/lib/members/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const membersByAttributeIntent: Intent = {
  id: "members-by-attribute",
  description: "Finds staff members by interests, level, or activity.",
  roles: ["staff", "admin"],
  match: (message) =>
    scoreTriggerFamily(message, [
      /\b(members interested in|members who like|who wants .+ training|beginners? who haven|inactive|stale)\b/i
    ]) *
    (1 +
      scoreEntity(message, [
        /\b(yoga|cycling|hiit|boxing|pilates|strength|beginner|intermediate|advanced|haven['â€™]?t been|inactive|stale|\d+\s+days?)\b/i
      ])),
  handle: async (message, _session, pendingAnswer) => {
    void pendingAnswer;
    const type = resolveClassType(message);
    const level = ["beginner", "intermediate", "advanced"].find((value) =>
      new RegExp(`\\b${value}\\b`, "i").test(message)
    );
    const days = message.match(/\b(\d+)\s+days?\b/i)?.[1];
    const stale = /\b(haven['’]?t been|inactive|stale)\b/i.test(message)
      ? Number(days ?? 30)
      : undefined;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await searchMembersByAttributes(supabase, {
      fitnessLevel: level,
      preferredClassType: type,
      staleAfterDays: stale
    });
    if (error)
      return {
        reply:
          "I couldn’t retrieve those members right now. Please try again shortly."
      };
    const criteria =
      [
        level,
        type && `interested in ${type}`,
        stale && `inactive for ${stale}+ days`
      ]
        .filter(Boolean)
        .join(", ") || "all attributes";
    return {
      reply: `${data.length} member${data.length === 1 ? "" : "s"} match ${criteria}.`,
      card: {
        kind: "members",
        title: "Member matches",
        members: data.map((member) => ({
          name: member.full_name || member.email,
          email: member.email,
          status: member.lifecycle_status,
          reason: `${member.fitness_level ?? "level not set"} · last visit ${member.last_visit_date ?? "not recorded"}`
        }))
      }
    };
  }
};
