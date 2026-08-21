import {
  resolveClassType,
  resolveDate,
  resolveInstructor,
  resolveTime
} from "@/lib/chatbot/entity-extraction";
import type { Intent } from "@/lib/chatbot/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ClassRow = {
  id: string;
  name: string;
  type: string;
  instructor: string;
  class_date: string;
  start_time: string;
  capacity: number;
  booked_count: number;
};
function label(row: ClassRow) {
  const [hours, minutes] = row.start_time.split(":").map(Number);
  return `${row.name} — ${row.class_date}, ${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
}
function pendingString(args: Record<string, unknown> | undefined, key: string) {
  const value = args?.[key];
  return typeof value === "string" ? value : undefined;
}
export const whoIsBookedIntent: Intent = {
  id: "who-is-booked",
  description: "Reports booking totals for a class to staff.",
  roles: ["staff", "admin"],
  match: (message) => {
    const normalized = message.toLowerCase();
    const asksForRoster =
      /\b(who is booked for|who's (in|booked)|attendee|roster)\b/i.test(
        normalized
      );
    const hasClassReference = Boolean(
      resolveDate(normalized) ||
      resolveTime(normalized) ||
      resolveClassType(normalized) ||
      resolveInstructor(normalized)
    );
    return asksForRoster ? (hasClassReference ? 2 : 1) : 0;
  },
  handle: async (message, _session, pendingAnswer) => {
    const normalized = message.toLowerCase();
    const date =
      resolveDate(normalized) ??
      pendingString(pendingAnswer?.partialArgs, "date");
    const instructor =
      resolveInstructor(normalized) ??
      pendingString(pendingAnswer?.partialArgs, "instructor");
    const type =
      resolveClassType(normalized) ??
      pendingString(pendingAnswer?.partialArgs, "classType");
    const time =
      resolveTime(normalized) ??
      pendingString(pendingAnswer?.partialArgs, "time");
    if (!date && !instructor && !type && !time)
      return {
        reply:
          "Which class would you like the roster for? Please include the class type, date, time, or instructor.",
        needsClarification: {
          missingSlot: "class",
          partialArgs: {},
          prompt: "Which class would you like the roster for?"
        }
      };
    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("classes")
      .select(
        "id, name, type, instructor, class_date, start_time, capacity, booked_count"
      )
      .order("class_date")
      .order("start_time");
    if (date) query = query.eq("class_date", date);
    if (instructor) query = query.ilike("instructor", `%${instructor}%`);
    if (type) query = query.ilike("type", type);
    if (time) query = query.eq("start_time", time);
    const { data, error } = await query;
    const classes = (data ?? []) as ClassRow[];
    if (error)
      return {
        reply:
          "I couldn’t retrieve class bookings right now. Please try again shortly."
      };
    if (!classes.length)
      return { reply: "I couldn’t find a class matching that request." };
    if (classes.length > 1)
      return {
        reply: `I found a few possible classes. Please be more specific:\n${classes.slice(0, 8).map(label).join("\n")}`,
        card: {
          kind: "schedule",
          classes: classes
            .slice(0, 8)
            .map((classRow) => ({
              title: classRow.name,
              type: classRow.type,
              instructor: classRow.instructor,
              date: classRow.class_date,
              time: classRow.start_time,
              capacity: classRow.capacity,
              bookedCount: classRow.booked_count
            }))
        }
      };
    const classRow = classes[0];
    return {
      reply: `${label(classRow)} has ${classRow.booked_count} of ${classRow.capacity} spots booked. Member names aren’t available in the current staff view yet.`
    };
  }
};
