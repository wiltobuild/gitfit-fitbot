import { resolveClassType } from "@/lib/chatbot/entity-extraction";
import { getMemberForUser } from "@/lib/members/queries";
import { scoreEntity, scoreTriggerFamily } from "@/lib/chatbot/match-scoring";
import type { Intent } from "@/lib/chatbot/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const recommendClassIntent: Intent = {
  id: "recommend-class", description: "Recommends upcoming classes based on the member's preferences.", roles: ["client"],
  match: (message) =>
    scoreTriggerFamily(message, [
      /\b(what should i book|what class is right for me|recommend (?:me )?(?:a )?class|what class should i take)\b/i
    ]) *
    (1 + scoreEntity(message, [])),
  handle: async (_message, session, pendingAnswer) => {
    void pendingAnswer;
    const supabase = await createSupabaseServerClient();
    const { data: member, error: memberError } = await getMemberForUser(supabase, session.user.id);
    if (memberError) return { reply: "I couldn't retrieve your class preferences right now. Please try again shortly." };
    if (!member) return { reply: "I don't have a member profile to base a recommendation on yet." };
    const preferredTypes = [...new Set((member.preferred_class_types ?? "").split(";").map((value: string) => resolveClassType(value.trim())).filter((type: string | undefined): type is "yoga" | "cycling" | "hiit" => Boolean(type)))] as Array<"yoga" | "cycling" | "hiit">;
    if (!preferredTypes.length) {
      return { reply: "I don't see any class preferences on your profile yet — want me to show the full schedule instead?", card: { kind: "notice", tone: "info", body: "I don't see any class preferences on your profile yet — want me to show the full schedule instead?" } };
    }
    const classTypes = preferredTypes.map((type) => type === "hiit" ? "HIIT" : `${type[0].toUpperCase()}${type.slice(1)}`);
    const { data: classes, error } = await supabase.from("classes").select("name, type, instructor, class_date, start_time, capacity, booked_count").gte("class_date", new Date().toISOString().slice(0, 10)).in("type", classTypes).order("class_date").order("start_time").limit(5);
    if (error) return { reply: "I couldn't retrieve class recommendations right now. Please try again shortly." };
    if (!classes?.length) {
      return { reply: "I don't see any upcoming classes matching what you're into right now — want me to show the full schedule instead?", card: { kind: "notice", tone: "info", body: "I don't see any upcoming classes matching what you're into right now — want me to show the full schedule instead?" } };
    }
    const goal = member.goals?.split(";")[0]?.trim();
    return { reply: `Since you're into ${preferredTypes.join(" and ")}${goal ? ` and working on ${goal}` : ""}, here's what's coming up:`, card: { kind: "schedule", classes: classes.map((classRow) => ({ title: classRow.name, type: classRow.type, instructor: classRow.instructor, date: classRow.class_date, time: classRow.start_time, capacity: classRow.capacity, bookedCount: classRow.booked_count })) } };
  }
};
