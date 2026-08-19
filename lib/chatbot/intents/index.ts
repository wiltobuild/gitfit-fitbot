import { helpIntent } from "@/lib/chatbot/intents/help";
import { scheduleIntent } from "@/lib/chatbot/intents/schedule";
import { myAppointmentsIntent } from "@/lib/chatbot/intents/my-appointments";
import { bookClassIntent } from "@/lib/chatbot/intents/book-class";
import { whoIsBookedIntent } from "@/lib/chatbot/intents/who-is-booked";
import { memberLookupIntent } from "@/lib/chatbot/intents/member-lookup";
import { workoutPlanIntent } from "@/lib/chatbot/intents/workout-plan";
import { timeOffIntent } from "@/lib/chatbot/intents/time-off";
import type { Intent } from "@/lib/chatbot/types";

// More specific intents are ordered before `scheduleIntent`, whose weak
// (bare date-word) matcher fallback is intentionally broad and otherwise
// wins by registration order — see schedule.ts's `otherIntentShaped`
// exclusion for the belt-and-suspenders half of this fix.
export const intents: Intent[] = [helpIntent, myAppointmentsIntent, bookClassIntent, whoIsBookedIntent, memberLookupIntent, workoutPlanIntent, timeOffIntent, scheduleIntent];
