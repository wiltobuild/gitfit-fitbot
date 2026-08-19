import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Intent } from "@/lib/chatbot/types";

const weekdayNames = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

// "Strong" keywords are schedule-specific enough to match on their own.
// "Weak" keywords are bare date/time words that other intents legitimately
// use too (e.g. "build me a 45-minute workout for today") — matching on
// these alone caused schedule to shadow workout-plan requests that merely
// mention "today". Require a strong keyword OR (a weak keyword AND the
// message doesn't look like a workout/exercise-planning request instead).
const strongScheduleKeywords = [
  "schedule",
  "class",
  "classes",
  "yoga",
  "cycling",
  "hiit",
  "spots",
  "spot",
  "full",
  "booked",
  "sofia",
  "martinez",
  "marcus",
  "lee",
  "avery",
  "thompson",
];

const weakDateKeywords = ["today", "tomorrow", "tonight", "this week", ...weekdayNames];

// Messages shaped like a request for a DIFFERENT intent that also happens to
// mention a bare date word (a weekday, "today", etc.) should not be
// swallowed by schedule's weak-keyword fallback. Each addition here is a
// real collision found via live testing, not speculative — see Phase 8
// (workout-plan) and Phase 9 (time-off) commit messages. This list is
// expected to grow; a bare date word is inherently ambiguous and this is
// the cheapest correct fix without coupling intents to each other's code.
const otherIntentShaped = /\b(workout|exercise|training|off|pto)\b/i;

const instructorTerms = ["sofia", "martinez", "marcus", "lee", "avery", "thompson"];

type ClassRow = {
  name: string;
  type: string;
  instructor: string;
  class_date: string;
  start_time: string;
  capacity: number;
  booked_count: number;
};

function hasWord(message: string, word: string) {
  return new RegExp(`\\b${word}\\b`, "i").test(message);
}

function toDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function resolveDateFilter(message: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (hasWord(message, "today") || hasWord(message, "tonight")) {
    return toDateString(today);
  }

  if (hasWord(message, "tomorrow")) {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return toDateString(tomorrow);
  }

  const requestedWeekday = weekdayNames.find((weekday) => hasWord(message, weekday));
  if (!requestedWeekday) {
    return undefined;
  }

  const targetDay = weekdayNames.indexOf(requestedWeekday);
  const date = new Date(today);
  date.setDate(today.getDate() + ((targetDay - today.getDay() + 7) % 7));
  return toDateString(date);
}

function formatDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(year, month - 1, day));
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const meridiem = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, "0")} ${meridiem}`;
}

export const scheduleIntent: Intent = {
  id: "schedule",
  description: "Lists classes and answers schedule availability questions.",
  roles: ["client", "staff"],
  match: (message) => {
    const normalizedMessage = message.toLowerCase();
    if (strongScheduleKeywords.some((keyword) => normalizedMessage.includes(keyword))) {
      return true;
    }
    if (otherIntentShaped.test(normalizedMessage)) {
      return false;
    }
    return weakDateKeywords.some((keyword) => normalizedMessage.includes(keyword));
  },
  handle: async (message) => {
    const normalizedMessage = message.toLowerCase();
    const dateFilter = resolveDateFilter(normalizedMessage);
    const instructorFilter = instructorTerms.find((term) => hasWord(normalizedMessage, term));
    const typeFilter = ["yoga", "cycling", "hiit"].find((type) => hasWord(normalizedMessage, type));
    const isAvailabilityQuery = ["spots", "spot", "full", "how many", "left"].some((keyword) =>
      normalizedMessage.includes(keyword),
    );

    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("classes")
      .select("name, type, instructor, class_date, start_time, capacity, booked_count")
      .order("class_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (dateFilter) {
      query = query.eq("class_date", dateFilter);
    }
    if (instructorFilter) {
      query = query.ilike("instructor", `%${instructorFilter}%`);
    }
    if (typeFilter) {
      query = query.ilike("type", typeFilter);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Unable to query classes", error);
      return { reply: "I couldn’t retrieve the class schedule right now. Please try again shortly." };
    }

    const classes = (data ?? []) as ClassRow[];
    if (classes.length === 0) {
      return { reply: "I couldn’t find any classes matching that schedule request." };
    }

    const visibleClasses = classes.slice(0, 8);
    const listings = visibleClasses.map((classRow) => {
      const time = formatTime(classRow.start_time);
      if (isAvailabilityQuery) {
        const spotsOpen = classRow.capacity - classRow.booked_count;
        const availability = spotsOpen === 0 ? "full" : `${spotsOpen} of ${classRow.capacity} spots open`;
        return `${classRow.name} (${classRow.type}) with ${classRow.instructor} — ${formatDate(classRow.class_date)}, ${time} — ${availability}.`;
      }

      const fullness = classRow.booked_count === classRow.capacity ? " (full)" : "";
      return `${classRow.name} (${classRow.type}) with ${classRow.instructor} — ${formatDate(classRow.class_date)}, ${time} — ${classRow.booked_count}/${classRow.capacity} spots${fullness}.`;
    });

    const remainingNote = classes.length > visibleClasses.length ? ` Showing the first ${visibleClasses.length} of ${classes.length} classes.` : "";
    const introduction = isAvailabilityQuery ? "Here’s the current availability:" : "Here’s the matching schedule:";

    return {
      reply: `${introduction}\n${listings.join("\n")}${remainingNote}`,
      card: { kind: "schedule", classes: classes.map((classRow) => ({ title: classRow.name, type: classRow.type, instructor: classRow.instructor, date: classRow.class_date, time: classRow.start_time, capacity: classRow.capacity, bookedCount: classRow.booked_count })) },
    };
  },
};
