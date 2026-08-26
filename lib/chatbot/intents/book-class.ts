import { cancelBooking, reserveBooking } from "@/lib/appointments/booking";
import {
  resolveClassType,
  resolveDate,
  resolveInstructor,
  resolveTime
} from "@/lib/chatbot/entity-extraction";
import { scoreEntity, scoreTriggerFamily } from "@/lib/chatbot/match-scoring";
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
type ClassFilters = {
  classType?: string;
  date?: string;
  time?: string;
  instructor?: string;
};
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
function classLabel(row: ClassRow) {
  return `${row.name} — ${formatDate(row.class_date)}, ${formatTime(row.start_time)}`;
}
function classFilters(message: string): ClassFilters {
  const normalized = message.toLowerCase();
  return {
    classType: resolveClassType(normalized),
    date: resolveDate(normalized),
    time: resolveTime(normalized),
    instructor: resolveInstructor(normalized)
  };
}
function stringArg(args: Record<string, unknown>, name: keyof ClassFilters) {
  const value = args[name];
  return typeof value === "string" ? value : undefined;
}
function mergedFilters(
  message: string,
  partialArgs?: Record<string, unknown>
): ClassFilters {
  const current = classFilters(message);
  return {
    classType:
      current.classType ?? (partialArgs && stringArg(partialArgs, "classType")),
    date: current.date ?? (partialArgs && stringArg(partialArgs, "date")),
    time: current.time ?? (partialArgs && stringArg(partialArgs, "time")),
    instructor:
      current.instructor ??
      (partialArgs && stringArg(partialArgs, "instructor"))
  };
}
async function findClasses(filters: ClassFilters, userId?: string) {
  const supabase = await createSupabaseServerClient();
  let query = userId
    ? supabase
        .from("bookings")
        .select(
          "class_id, classes(id, name, type, instructor, class_date, start_time, capacity, booked_count)"
        )
        .eq("user_id", userId)
    : supabase
        .from("classes")
        .select(
          "id, name, type, instructor, class_date, start_time, capacity, booked_count"
        );
  if (userId) {
    if (filters.date) query = query.eq("classes.class_date", filters.date);
    if (filters.instructor)
      query = query.ilike("classes.instructor", `%${filters.instructor}%`);
    if (filters.classType)
      query = query.ilike("classes.type", filters.classType);
    if (filters.time) query = query.eq("classes.start_time", filters.time);
  } else {
    if (filters.date) query = query.eq("class_date", filters.date);
    if (filters.instructor)
      query = query.ilike("instructor", `%${filters.instructor}%`);
    if (filters.classType) query = query.ilike("type", filters.classType);
    if (filters.time) query = query.eq("start_time", filters.time);
  }
  const { data, error } = await query.order(
    userId ? "created_at" : "class_date",
    { ascending: true }
  );
  if (error) return { classes: [] as ClassRow[], error: true };
  const booked = (
    (data ?? []) as unknown as Array<{ classes: ClassRow | ClassRow[] | null }>
  ).flatMap((row) =>
    Array.isArray(row.classes) ? row.classes : row.classes ? [row.classes] : []
  );
  return {
    classes: userId ? booked : ((data ?? []) as ClassRow[]),
    error: false
  };
}
function resolutionReply(classes: ClassRow[], action: "book" | "cancel") {
  if (!classes.length)
    return action === "cancel"
      ? "You don't have a matching booking to cancel."
      : "I couldn't find a class matching that request.";
  return `I found a few possible classes. Please be more specific:\n${classes.slice(0, 8).map(classLabel).join("\n")}`;
}
function disambiguationCard(classes: ClassRow[], action: "book" | "cancel") {
  return {
    kind: "disambiguation" as const,
    prompt: "I found a few possible classes — which one?",
    options: classes.slice(0, 8).map((row) => ({
      label: classLabel(row),
      detail: `with ${row.instructor}`,
      sendMessage: `${action === "cancel" ? "cancel my booking for" : "book me into"} ${row.type} on ${row.class_date} at ${formatTime(row.start_time)} with ${row.instructor}`
    }))
  };
}
const timeOffShaped = /\b(day off|days off|time off|off work|pto)\b/i;
const cancelPattern =
  /\b(cancel my|i can(?:not|'t) make it to|i won(?:not|'t) be able to attend|drop me from|take me out of)\b/i;
function bookingCard(
  row: ClassRow,
  outcome: "confirmed" | "cancelled" | "failed",
  reason?: string
) {
  return {
    kind: "booking" as const,
    className: row.name,
    date: row.class_date,
    time: row.start_time,
    instructor: row.instructor,
    outcome,
    reason
  };
}
export const bookClassIntent: Intent = {
  id: "book-class",
  description: "Books or cancels the current member's class booking.",
  // Booking a class is a client-only action -- staff/admin operate the
  // studio, they don't book into it as a member. Matches the same
  // restriction now enforced on /appointments and its API routes.
  roles: ["client"],
  match: (message) =>
    !timeOffShaped.test(message)
      ? scoreTriggerFamily(message, [
          /\b(book me (into|a)|reserve|sign me up for|get me a spot|can i get a spot)\b/i,
          cancelPattern
        ]) *
        (1 +
          scoreEntity(message, [
            /\b(yoga|cycling|hiit|boxing|pilates|strength|today|tomorrow|tonight|sunday|monday|tuesday|wednesday|thursday|friday|saturday|sofia|martinez|marcus|lee|avery|thompson)\b/i
          ]))
      : 0,
  handle: async (message, session, pendingAnswer) => {
    const cancelling =
      cancelPattern.test(message) ||
      pendingAnswer?.partialArgs.action === "cancel";
    const filters = mergedFilters(message, pendingAnswer?.partialArgs);
    if (!cancelling && filters.classType && !filters.date && !filters.time)
      return {
        reply: "What day and time works for you?",
        needsClarification: {
          missingSlot: "date",
          partialArgs: { ...filters, action: "book" },
          prompt: "What day and time works for you?"
        }
      };
    const resolved = await findClasses(
      filters,
      cancelling ? session.user.id : undefined
    );
    if (resolved.error)
      return {
        reply:
          "I couldn't retrieve classes right now. Please try again shortly."
      };
    if (resolved.classes.length !== 1) {
      if (cancelling && !resolved.classes.length) {
        const available = await findClasses(filters);
        if (!available.error && available.classes.length === 1)
          return {
            reply: "You don't have a booking for that class.",
            card: bookingCard(
              available.classes[0],
              "failed",
              "You don't have a booking for that class."
            ),
            resolvedEntities: {
              classId: available.classes[0].id,
              date: available.classes[0].class_date
            }
          };
      }
      return resolved.classes.length
        ? {
            reply: "I found a few possible matches.",
            card: disambiguationCard(resolved.classes, cancelling ? "cancel" : "book")
          }
        : { reply: resolutionReply(resolved.classes, cancelling ? "cancel" : "book") };
    }
    const classRow = resolved.classes[0];
    const supabase = await createSupabaseServerClient();
    if (cancelling) {
      const result = await cancelBooking(
        supabase,
        session.user.id,
        classRow.id
      );
      return result.ok
        ? {
            reply: `Your booking for ${classLabel(classRow)} has been cancelled.`,
            card: bookingCard(classRow, "cancelled"),
            resolvedEntities: {
              classId: classRow.id,
              date: classRow.class_date
            }
          }
        : {
            reply:
              result.code === "not_booked"
                ? "You don't have a booking for that class."
                : "I couldn't cancel that booking right now. Please try again shortly.",
            card: bookingCard(classRow, "failed", result.message),
            resolvedEntities: {
              classId: classRow.id,
              date: classRow.class_date
            }
          };
    }
    const result = await reserveBooking(supabase, session.user.id, classRow.id);
    if (result.ok)
      return {
        reply: `You're booked for ${classLabel(classRow)}.`,
        card: bookingCard(classRow, "confirmed"),
        resolvedEntities: { classId: classRow.id, date: classRow.class_date }
      };
    if (result.code === "already_booked")
      return {
        reply: `You're already booked into ${classLabel(classRow)}.`,
        card: bookingCard(classRow, "failed", result.message),
        resolvedEntities: { classId: classRow.id, date: classRow.class_date }
      };
    return {
      reply: result.message,
      card: bookingCard(classRow, "failed", result.message),
      resolvedEntities: { classId: classRow.id, date: classRow.class_date }
    };
  }
};
