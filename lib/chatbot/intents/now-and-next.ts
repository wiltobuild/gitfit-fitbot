import { isCurrentOrNext } from "@/lib/classes/current-or-next";
import type { Intent } from "@/lib/chatbot/types";
import { scoreEntity, scoreTriggerFamily } from "@/lib/chatbot/match-scoring";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ClassRow = { name: string; type: string; instructor: string; class_date: string; start_time: string; duration_minutes: number; capacity: number; booked_count: number };
const dateString = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const formatTime = (time: string) => { const [hours, minutes] = time.split(":").map(Number); return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`; };
const endTime = (classRow: ClassRow) => { const [hours, minutes] = classRow.start_time.split(":").map(Number); const totalMinutes = hours * 60 + minutes + classRow.duration_minutes; return formatTime(`${String(Math.floor(totalMinutes / 60) % 24).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`); };

export const nowAndNextIntent: Intent = {
  id: "now-and-next", description: "Reports the current and next studio classes.", roles: ["client", "staff", "admin"],
  match: (message) =>
    scoreTriggerFamily(message, [
      /\b(what'?s happening now|what'?s next|what'?s going on right now|current class|next class)\b/i
    ]) *
    (1 + scoreEntity(message, [])),
  handle: async (_message, _session, pendingAnswer) => {
    void pendingAnswer;
    const now = new Date(); const today = dateString(now); const tomorrowDate = new Date(now); tomorrowDate.setDate(now.getDate() + 1); const tomorrow = dateString(tomorrowDate);
    const supabase = await createSupabaseServerClient();
    const { data: todayClasses, error: todayError } = await supabase.from("classes").select("name, type, instructor, class_date, start_time, duration_minutes, capacity, booked_count").eq("class_date", today).order("start_time");
    if (todayError) return { reply: "I couldn't retrieve the studio schedule right now. Please try again shortly." };
    const classes = (todayClasses ?? []) as ClassRow[];
    const currentClass = classes.find((classRow) => isCurrentOrNext(classRow, now));
    const upcomingToday = classes.find((classRow) => { const [hours, minutes] = classRow.start_time.split(":").map(Number); return hours * 60 + minutes >= now.getHours() * 60 + now.getMinutes() && classRow !== currentClass; });
    let nextClass = upcomingToday;
    let nextIsTomorrow = false;
    if (!currentClass && !nextClass) {
      const { data: tomorrowClasses, error: tomorrowError } = await supabase.from("classes").select("name, type, instructor, class_date, start_time, duration_minutes, capacity, booked_count").eq("class_date", tomorrow).order("start_time").limit(1);
      if (tomorrowError) return { reply: "I couldn't retrieve the studio schedule right now. Please try again shortly." };
      nextClass = tomorrowClasses?.[0] as ClassRow | undefined; nextIsTomorrow = Boolean(nextClass);
    }
    if (!currentClass && !nextClass) return { reply: "Nothing's on the schedule for today or tomorrow." };
    const visibleClasses = [currentClass, nextClass].filter((classRow): classRow is ClassRow => Boolean(classRow));
    const reply = currentClass ? `Right now: ${currentClass.name} with ${currentClass.instructor}, ends at ${endTime(currentClass)}.${nextClass ? ` Next up: ${nextClass.name} with ${nextClass.instructor} at ${formatTime(nextClass.start_time)}.` : ""}` : `Nothing's running right now — next up${nextIsTomorrow ? " tomorrow" : ""}: ${nextClass!.name} with ${nextClass!.instructor} at ${formatTime(nextClass!.start_time)}.`;
    return { reply, card: { kind: "schedule", classes: visibleClasses.map((classRow) => ({ title: classRow.name, type: classRow.type, instructor: classRow.instructor, date: classRow.class_date, time: classRow.start_time, capacity: classRow.capacity, bookedCount: classRow.booked_count })) } };
  }
};
