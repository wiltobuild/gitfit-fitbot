import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Intent } from "@/lib/chatbot/types";

const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
type ClassRow = { id: string; name: string; type: string; instructor: string; class_date: string; start_time: string; capacity: number; booked_count: number };
const hasWord = (message: string, word: string) => new RegExp(`\\b${word}\\b`, "i").test(message);
const toDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
function resolveDate(message: string) { const today = new Date(); today.setHours(0, 0, 0, 0); if (hasWord(message, "today") || hasWord(message, "tonight")) return toDate(today); if (hasWord(message, "tomorrow")) { const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1); return toDate(tomorrow); } const weekday = weekdays.find((day) => hasWord(message, day)); if (!weekday) return undefined; const date = new Date(today); date.setDate(today.getDate() + ((weekdays.indexOf(weekday) - today.getDay() + 7) % 7)); return toDate(date); }
function resolveTime(message: string) { const match = message.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?(?:m\.?)|p\.?(?:m\.?))\b/i); if (!match) return undefined; let hours = Number(match[1]); if (hours === 12) hours = 0; if (match[3].toLowerCase().startsWith("p")) hours += 12; return `${String(hours).padStart(2, "0")}:${String(Number(match[2] ?? 0)).padStart(2, "0")}`; }
function label(row: ClassRow) { const [hours, minutes] = row.start_time.split(":").map(Number); return `${row.name} — ${row.class_date}, ${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`; }

export const whoIsBookedIntent: Intent = {
  id: "who-is-booked", description: "Reports booking totals for a class to staff.", roles: ["staff", "admin"],
  match: (message) => {
    const normalized = message.toLowerCase();
    const asksForRoster = /\b(who is booked for|who's (in|booked)|attendee|roster)\b/i.test(normalized);
    const hasClassReference = Boolean(
      resolveDate(normalized) || resolveTime(normalized) || ["yoga", "cycling", "hiit", "sofia", "martinez", "marcus", "lee", "avery", "thompson"].some((term) => hasWord(normalized, term)),
    );
    return asksForRoster && hasClassReference;
  },
  handle: async (message) => {
    const normalized = message.toLowerCase(); const supabase = await createSupabaseServerClient(); let query = supabase.from("classes").select("id, name, type, instructor, class_date, start_time, capacity, booked_count").order("class_date").order("start_time");
    const date = resolveDate(normalized); const instructor = ["sofia", "martinez", "marcus", "lee", "avery", "thompson"].find((term) => hasWord(normalized, term)); const type = ["yoga", "cycling", "hiit"].find((term) => hasWord(normalized, term)); const time = resolveTime(normalized);
    if (date) query = query.eq("class_date", date); if (instructor) query = query.ilike("instructor", `%${instructor}%`); if (type) query = query.ilike("type", type); if (time) query = query.eq("start_time", time);
    const { data, error } = await query; const classes = (data ?? []) as ClassRow[];
    if (error) return { reply: "I couldn’t retrieve class bookings right now. Please try again shortly." };
    if (classes.length === 0) return { reply: "I couldn’t find a class matching that request." };
    if (classes.length > 1) return {
      reply: `I found a few possible classes. Please be more specific:\n${classes.slice(0, 8).map(label).join("\n")}`,
      card: { kind: "schedule", classes: classes.slice(0, 8).map((classRow) => ({ title: classRow.name, type: classRow.type, instructor: classRow.instructor, date: classRow.class_date, time: classRow.start_time, capacity: classRow.capacity, bookedCount: classRow.booked_count })) },
    };
    const classRow = classes[0];
    // Use classes.booked_count (kept in sync by the bookings triggers) rather than
    // counting bookings rows directly: seed data set booked_count without matching
    // bookings rows (no real users to attribute it to), so a raw row count of
    // `bookings` would read as near-empty for classes seeded with a phantom count,
    // even though real bookings made through the app do increment this same field.
    return { reply: `${label(classRow)} has ${classRow.booked_count} of ${classRow.capacity} spots booked. Member names aren’t available in the current staff view yet.` };
  },
};
