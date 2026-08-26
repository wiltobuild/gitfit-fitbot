import { resolveClassType, resolveDate, resolveInstructor, resolveTime } from "@/lib/chatbot/entity-extraction";
import { scoreEntity, scoreTriggerFamily } from "@/lib/chatbot/match-scoring";
import type { Intent } from "@/lib/chatbot/types";
import { getClassRoster } from "@/lib/classes/roster";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ClassRow = { id: string; name: string; type: string; instructor: string; class_date: string; start_time: string; capacity: number; booked_count: number };
const rosterPattern = /\b(who is booked for|who's (in|booked)|attendee|roster)\b/i;
const classReferencePattern = /\b(yoga|cycling|hiit|boxing|pilates|strength|today|tomorrow|tonight|sunday|monday|tuesday|wednesday|thursday|friday|saturday|sofia|martinez|marcus|lee|avery|thompson|diego|reyes|elena|cruz|jordan|blake|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)\b)/i;
function label(row: ClassRow) { const [hours, minutes] = row.start_time.split(":").map(Number); return `${row.name} — ${row.class_date}, ${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`; }
function pendingString(args: Record<string, unknown> | undefined, key: string) { const value = args?.[key]; return typeof value === "string" ? value : undefined; }

export const whoIsBookedIntent: Intent = {
  id: "who-is-booked", description: "Reports booking totals for a class to staff.", roles: ["staff", "admin"],
  match: (message) => {
    const normalized = message.toLowerCase();
    const asksForRoster = scoreTriggerFamily(normalized, [rosterPattern]);
    const hasClassReference = Boolean(resolveDate(normalized) || resolveTime(normalized) || resolveClassType(normalized) || resolveInstructor(normalized));
    return asksForRoster
      ? hasClassReference
        ? scoreTriggerFamily(normalized, [rosterPattern]) * (1 + scoreEntity(normalized, [classReferencePattern]))
        : 1
      : 0;
  },
  handle: async (message, _session, pendingAnswer) => {
    const normalized = message.toLowerCase();
    const date = resolveDate(normalized) ?? pendingString(pendingAnswer?.partialArgs, "date");
    const instructor = resolveInstructor(normalized) ?? pendingString(pendingAnswer?.partialArgs, "instructor");
    const type = resolveClassType(normalized) ?? pendingString(pendingAnswer?.partialArgs, "classType");
    const time = resolveTime(normalized) ?? pendingString(pendingAnswer?.partialArgs, "time");
    if (!date && !instructor && !type && !time) return { reply: "Which class would you like the roster for? Please include the class type, date, time, or instructor.", needsClarification: { missingSlot: "class", partialArgs: {}, prompt: "Which class would you like the roster for?" } };
    const supabase = await createSupabaseServerClient();
    let query = supabase.from("classes").select("id, name, type, instructor, class_date, start_time, capacity, booked_count").order("class_date").order("start_time");
    if (date) query = query.eq("class_date", date); if (instructor) query = query.ilike("instructor", `%${instructor}%`); if (type) query = query.ilike("type", type); if (time) query = query.eq("start_time", time);
    const { data, error } = await query; const classes = (data ?? []) as ClassRow[];
    if (error) return { reply: "I couldn't retrieve class bookings right now. Please try again shortly." }; if (!classes.length) return { reply: "I couldn't find a class matching that request." };
    if (classes.length > 1) return { reply: "I found a few possible classes.", card: { kind: "disambiguation", prompt: "Which class would you like the roster for?", options: classes.slice(0, 8).map((classRow) => ({ label: label(classRow), detail: `with ${classRow.instructor}`, sendMessage: `who is booked for ${classRow.type} on ${classRow.class_date} at ${label(classRow).split(", ")[1]} with ${classRow.instructor}` })) } };
    const classRow = classes[0];
    let attendees;
    try {
      attendees = await getClassRoster(supabase, classRow.id);
    } catch {
      return { reply: "I couldn't retrieve attendee names right now. Please try again shortly." };
    }
    const names = attendees.map((attendee) => attendee.name).filter((name): name is string => Boolean(name));
    const namedCount = names.length; const bookingSummary = `${label(classRow)} has ${classRow.booked_count} of ${classRow.capacity} spots booked`;
    const reply = namedCount === classRow.booked_count ? (namedCount ? `${bookingSummary}. Attendees: ${names.join(", ")}.` : `${bookingSummary}.`) : namedCount > 0 ? `${bookingSummary}. ${namedCount} attendee(s) on record: ${names.join(", ")}.` : `${bookingSummary}, but no attendee names are on record for this class.`;
    return { reply, resolvedEntities: { classId: classRow.id, date: classRow.class_date } };
  }
};
