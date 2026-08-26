import { createSupabaseServerClient } from "@/lib/supabase/server";
import { todayDate } from "@/lib/members/queries";
import type { Intent } from "@/lib/chatbot/types";
import { scoreEntity, scoreTriggerFamily } from "@/lib/chatbot/match-scoring";
function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function matchingInstructors(message: string, instructors: string[]) {
  const normalized = message.toLowerCase();
  return instructors.filter((name) =>
    name
      .split(/\s+/)
      .some((part) => new RegExp(`\\b${escapeRegExp(part)}\\b`, "i").test(normalized))
  );
}
export async function getInstructorClasses(message: string) {
  const supabase = await createSupabaseServerClient();
  // The roster of "who teaches here" only needs the instructor names already
  // visible on the public class schedule -- not the staff-only member list
  // (list_members_for_staff hard-fails for non-staff callers), so this stays
  // usable for the client role the intent is registered for.
  const { data: classRows, error: classesError } = await supabase
    .from("classes")
    .select("instructor");
  if (classesError)
    return {
      reply:
        "I couldn't retrieve instructors right now. Please try again shortly."
    };
  const instructors = [
    ...new Set(
      (classRows ?? [])
        .map((row) => row.instructor)
        .filter((name): name is string => Boolean(name))
    )
  ];
  const matches = matchingInstructors(message, instructors);
  if (!matches.length)
    return { reply: "Tell me whose schedule you'd like to see." };
  if (matches.length > 1)
    return {
      reply: "I found a few possible instructors.",
      card: {
        kind: "disambiguation" as const,
        prompt: "Which instructor did you mean?",
        options: matches.map((name) => ({
          label: name,
          sendMessage: `show classes for ${name}`
        }))
      }
    };
  const instructor = matches[0];
  const { data, error } = await supabase
    .from("classes")
    .select(
      "name, type, instructor, class_date, start_time, capacity, booked_count"
    )
    .ilike("instructor", `%${instructor}%`)
    .gte("class_date", todayDate())
    .order("class_date")
    .order("start_time");
  if (error)
    return {
      reply:
        "I couldn't retrieve that instructor's classes right now. Please try again shortly."
    };
  const classes = data ?? [];
  if (!classes.length)
    return { reply: `${instructor} has no upcoming classes scheduled.` };
  return {
    reply: `Upcoming classes for ${instructor}:\n${classes.map((row) => `${row.name} — ${row.class_date}, ${row.start_time}`).join("\n")}`,
    card: {
      kind: "schedule" as const,
      classes: classes.map((row) => ({
        title: row.name,
        type: row.type,
        instructor: row.instructor,
        date: row.class_date,
        time: row.start_time,
        capacity: row.capacity,
        bookedCount: row.booked_count
      }))
    }
  };
}
export const instructorClassesIntent: Intent = {
  id: "instructor-classes",
  description: "Lists an instructor's upcoming classes.",
  roles: ["client", "staff", "admin"],
  match: (message) =>
    scoreTriggerFamily(message, [
      /\b(instructor|teach(?:es|ing)?|classes for|schedule for)\b/i
    ]) *
    (1 +
      scoreEntity(message, [
        /\b(sofia|martinez|marcus|lee|avery|thompson|diego|reyes|elena|cruz|jordan|blake)\b/i
      ])),
  handle: async (message, _session, pendingAnswer) => {
    void pendingAnswer;
    return getInstructorClasses(message);
  }
};
