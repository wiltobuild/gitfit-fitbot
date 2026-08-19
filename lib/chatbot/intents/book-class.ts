import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Intent } from "@/lib/chatbot/types";

const weekdayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const instructorTerms = ["sofia", "martinez", "marcus", "lee", "avery", "thompson"];

type ClassRow = { id: string; name: string; type: string; instructor: string; class_date: string; start_time: string; capacity: number; booked_count: number };

function hasWord(message: string, word: string) { return new RegExp(`\\b${word}\\b`, "i").test(message); }
function toDateString(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function resolveDateFilter(message: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (hasWord(message, "today") || hasWord(message, "tonight")) return toDateString(today);
  if (hasWord(message, "tomorrow")) { const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1); return toDateString(tomorrow); }
  const weekday = weekdayNames.find((name) => hasWord(message, name));
  if (!weekday) return undefined;
  const date = new Date(today); date.setDate(today.getDate() + ((weekdayNames.indexOf(weekday) - today.getDay() + 7) % 7)); return toDateString(date);
}
function resolveTimeFilter(message: string) {
  const match = message.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?(?:m\.?)|p\.?(?:m\.?))\b/i);
  if (!match) return undefined;
  let hours = Number(match[1]); const minutes = Number(match[2] ?? 0); const isPm = match[3].toLowerCase().startsWith("p");
  if (hours === 12) hours = 0; if (isPm) hours += 12;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
function formatDate(date: string) { const [year, month, day] = date.split("-").map(Number); return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date(year, month - 1, day)); }
function formatTime(time: string) { const [hours, minutes] = time.split(":").map(Number); return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`; }
function classLabel(classRow: ClassRow) { return `${classRow.name} — ${formatDate(classRow.class_date)}, ${formatTime(classRow.start_time)}`; }

async function findClasses(message: string, userId?: string) {
  const normalized = message.toLowerCase(); const supabase = await createSupabaseServerClient();
  let query = userId
    ? supabase.from("bookings").select("class_id, classes(id, name, type, instructor, class_date, start_time, capacity, booked_count)").eq("user_id", userId)
    : supabase.from("classes").select("id, name, type, instructor, class_date, start_time, capacity, booked_count");
  const date = resolveDateFilter(normalized); const instructor = instructorTerms.find((term) => hasWord(normalized, term)); const type = ["yoga", "cycling", "hiit"].find((term) => hasWord(normalized, term)); const time = resolveTimeFilter(normalized);
  if (userId) {
    if (date) query = query.eq("classes.class_date", date); if (instructor) query = query.ilike("classes.instructor", `%${instructor}%`); if (type) query = query.ilike("classes.type", type); if (time) query = query.eq("classes.start_time", time);
  } else { if (date) query = query.eq("class_date", date); if (instructor) query = query.ilike("instructor", `%${instructor}%`); if (type) query = query.ilike("type", type); if (time) query = query.eq("start_time", time); }
  const { data, error } = await query.order(userId ? "created_at" : "class_date", { ascending: true });
  if (error) return { classes: [] as ClassRow[], error: true };
  const bookedClasses = ((data ?? []) as unknown as Array<{ classes: ClassRow | ClassRow[] | null }>)
    .flatMap((row) => (Array.isArray(row.classes) ? row.classes : row.classes ? [row.classes] : []));
  return { classes: userId ? bookedClasses : (data ?? []) as ClassRow[], error: false };
}
function resolutionReply(classes: ClassRow[], action: "book" | "cancel") {
  if (!classes.length) return action === "cancel" ? "You don’t have a matching booking to cancel." : "I couldn’t find a class matching that request.";
  return `I found a few possible classes. Please be more specific:\n${classes.slice(0, 8).map(classLabel).join("\n")}`;
}
function bookingError(error: { code?: string; message?: string }) {
  const message = error.message?.toLowerCase() ?? "";
  if (message.includes("class is full")) return "That class is full.";
  if (error.code === "23505") return "You’re already booked into that class.";
  return "I couldn’t update your booking right now. Please try again shortly.";
}

export const bookClassIntent: Intent = {
  id: "book-class", description: "Books or cancels the current member's class booking.", roles: ["client", "staff"],
  match: (message) => /\b(book me (into|a)|reserve|sign me up for|cancel my)\b/i.test(message),
  handle: async (message, session) => {
    const cancelling = /\bcancel\b/i.test(message); const resolved = await findClasses(message, cancelling ? session.user.id : undefined);
    if (resolved.error) return { reply: "I couldn’t retrieve classes right now. Please try again shortly." };
    if (resolved.classes.length !== 1) return { reply: resolutionReply(resolved.classes, cancelling ? "cancel" : "book") };
    const classRow = resolved.classes[0]; const supabase = await createSupabaseServerClient();
    if (cancelling) {
      const { error } = await supabase.from("bookings").delete().eq("class_id", classRow.id).eq("user_id", session.user.id);
      return error ? { reply: "I couldn’t cancel that booking right now. Please try again shortly." } : { reply: `Your booking for ${classLabel(classRow)} has been cancelled.` };
    }
    const { error } = await supabase.from("bookings").insert({ class_id: classRow.id, user_id: session.user.id });
    return error ? { reply: bookingError(error) } : { reply: `You’re booked for ${classLabel(classRow)}.` };
  },
};
