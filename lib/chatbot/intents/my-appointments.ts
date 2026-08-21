import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUpcomingBookingsForUser } from "@/lib/members/queries";
import type { Intent } from "@/lib/chatbot/types";
import { scoreEntity, scoreTriggerFamily } from "@/lib/chatbot/match-scoring";

function formatDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(new Date(year, month - 1, day));
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
}

export const myAppointmentsIntent: Intent = {
  id: "my-appointments",
  description: "Lists the current member's upcoming class bookings.",
  roles: ["client", "staff", "admin"],
  match: (message) =>
    scoreTriggerFamily(message, [
      /\b(my (appointments|bookings|classes)|what appointments do i have|what am i booked for)\b/i
    ]) *
    (1 + scoreEntity(message, [/\b(appointments?|bookings?|classes)\b/i])),
  handle: async (_message, session, pendingAnswer) => {
    void pendingAnswer;
    const supabase = await createSupabaseServerClient();
    let classes;
    try {
      classes = await getUpcomingBookingsForUser(supabase, session.user.id);
    } catch (error) {

      console.error("Unable to query bookings", error);
      return {
        reply:
          "I couldn’t retrieve your upcoming bookings right now. Please try again shortly."
      };
    }

    if (classes.length === 0) {
      return {
        reply:
          "You don’t have any upcoming class bookings. Ask me what’s on the schedule to find a class."
      };
    }

    return {
      reply: `Here are your upcoming bookings:\n${classes
        .map(
          (classRow) =>
            `${classRow.name} (${classRow.type}) with ${classRow.instructor} — ${formatDate(classRow.class_date)}, ${formatTime(classRow.start_time)}.`
        )
        .join("\n")}`,
      card: {
        kind: "schedule",
        classes: classes.map((classRow) => ({
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
  }
};
