import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Intent } from "@/lib/chatbot/types";
import { scoreEntity, scoreTriggerFamily } from "@/lib/chatbot/match-scoring";

type ClassRow = {
  name: string;
  type: string;
  instructor: string;
  class_date: string;
  start_time: string;
  capacity: number;
  booked_count: number;
};

function formatDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(
    new Date(year, month - 1, day),
  );
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
}

function todayDate() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

export const myAppointmentsIntent: Intent = {
  id: "my-appointments",
  description: "Lists the current member's upcoming class bookings.",
  roles: ["client", "staff", "admin"],
  match: (message) => Number(/\b(my (appointments|bookings|classes)|what appointments do i have|what am i booked for)\b/i.test(message)),
  handle: async (_message, session) => {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("bookings")
      .select("created_at, classes!inner(name, type, instructor, class_date, start_time, capacity, booked_count)")
      .eq("user_id", session.user.id)
      .gte("classes.class_date", todayDate())
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Unable to query bookings", error);
      return { reply: "I couldn’t retrieve your upcoming bookings right now. Please try again shortly." };
    }

    const classes = (data ?? [])
      .map((booking) => booking.classes as unknown as ClassRow | null)
      .filter((classRow): classRow is ClassRow => classRow !== null)
      .sort((a, b) => `${a.class_date} ${a.start_time}`.localeCompare(`${b.class_date} ${b.start_time}`));

    if (classes.length === 0) {
      return { reply: "You don’t have any upcoming class bookings. Ask me what’s on the schedule to find a class." };
    }

    return {
      reply: `Here are your upcoming bookings:\n${classes
        .map((classRow) => `${classRow.name} (${classRow.type}) with ${classRow.instructor} — ${formatDate(classRow.class_date)}, ${formatTime(classRow.start_time)}.`)
        .join("\n")}`,
      card: { kind: "schedule", classes: classes.map((classRow) => ({ title: classRow.name, type: classRow.type, instructor: classRow.instructor, date: classRow.class_date, time: classRow.start_time, capacity: classRow.capacity, bookedCount: classRow.booked_count })) },
    };
  },
};
