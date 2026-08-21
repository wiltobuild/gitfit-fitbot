import {
  resolveClassType,
  resolveDate,
  resolveInstructor,
  resolveTime
} from "@/lib/chatbot/entity-extraction";
import { scoreEntity, scoreTriggerFamily } from "@/lib/chatbot/match-scoring";
import type { Intent } from "@/lib/chatbot/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const infoPattern = /\b(tell me about|what is|details on|who teaches)\b/i;
function pendingString(args: Record<string, unknown> | undefined, key: string) {
  const value = args?.[key];
  return typeof value === "string" ? value : undefined;
}
export const classInfoIntent: Intent = {
  id: "class-info",
  description: "Provides details for a specific class.",
  roles: ["client", "staff", "admin"],
  match: (message) =>
    scoreTriggerFamily(message, [infoPattern]) *
    (1 + scoreEntity(message, [/\b(yoga|cycling|hiit)\b/i])),
  handle: async (message, _session, pendingAnswer) => {
    const normalized = message.toLowerCase();
    const type =
      resolveClassType(normalized) ??
      pendingString(pendingAnswer?.partialArgs, "classType");
    const date =
      resolveDate(normalized) ??
      pendingString(pendingAnswer?.partialArgs, "date");
    const time =
      resolveTime(normalized) ??
      pendingString(pendingAnswer?.partialArgs, "time");
    const instructor =
      resolveInstructor(normalized) ??
      pendingString(pendingAnswer?.partialArgs, "instructor");
    if (type && !date)
      return {
        reply: "Which day are you interested in?",
        needsClarification: {
          missingSlot: "date",
          partialArgs: {
            classType: type,
            ...(time ? { time } : {}),
            ...(instructor ? { instructor } : {})
          },
          prompt: "Which day are you interested in?"
        }
      };
    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("classes")
      .select(
        "name, type, instructor, class_date, start_time, capacity, booked_count"
      )
      .order("class_date")
      .order("start_time");
    if (type) query = query.ilike("type", type);
    if (date) query = query.eq("class_date", date);
    if (time) query = query.eq("start_time", time);
    if (instructor) query = query.ilike("instructor", `%${instructor}%`);
    const { data, error } = await query;
    if (error)
      return {
        reply:
          "I couldn't retrieve class details right now. Please try again shortly."
      };
    const classes = data ?? [];
    if (!classes.length)
      return { reply: "I couldn't find a class matching that request." };
    if (classes.length > 1)
      return {
        reply: `I found a few possible classes. Please be more specific:\n${classes
          .slice(0, 8)
          .map((row) => `${row.name} — ${row.class_date}, ${row.start_time}`)
          .join("\n")}`
      };
    const row = classes[0];
    return {
      reply: `${row.name} is taught by ${row.instructor} on ${row.class_date} at ${row.start_time}. It has ${row.booked_count} of ${row.capacity} spots booked.`,
      card: {
        kind: "schedule",
        classes: [
          {
            title: row.name,
            type: row.type,
            instructor: row.instructor,
            date: row.class_date,
            time: row.start_time,
            capacity: row.capacity,
            bookedCount: row.booked_count
          }
        ]
      }
    };
  }
};
