import { helpIntent } from "@/lib/chatbot/intents/help";
import { scheduleIntent } from "@/lib/chatbot/intents/schedule";
import { myAppointmentsIntent } from "@/lib/chatbot/intents/my-appointments";
import { bookClassIntent } from "@/lib/chatbot/intents/book-class";
import { studioCapacityIntent } from "@/lib/chatbot/intents/studio-capacity";
import { instructorClassesIntent } from "@/lib/chatbot/intents/instructor-classes";
import { classInfoIntent } from "@/lib/chatbot/intents/class-info";
import { rosterSummaryIntent } from "@/lib/chatbot/intents/roster-summary";
import { whoIsBookedIntent } from "@/lib/chatbot/intents/who-is-booked";
import { memberLookupIntent } from "@/lib/chatbot/intents/member-lookup";
import { workoutPlanIntent } from "@/lib/chatbot/intents/workout-plan";
import { timeOffIntent } from "@/lib/chatbot/intents/time-off";
import { timeOffReviewIntent } from "@/lib/chatbot/intents/time-off-review";
import { retentionLookupIntent } from "@/lib/chatbot/intents/retention-lookup";
import { outreachDraftIntent } from "@/lib/chatbot/intents/outreach-draft";
import { outreachSendIntent } from "@/lib/chatbot/intents/outreach-send";
import { myGoalsIntent } from "@/lib/chatbot/intents/my-goals";
import { myActivityIntent } from "@/lib/chatbot/intents/my-activity";
import { membersByAttributeIntent } from "@/lib/chatbot/intents/members-by-attribute";
import { recommendClassIntent } from "@/lib/chatbot/intents/recommend-class";
import { nowAndNextIntent } from "@/lib/chatbot/intents/now-and-next";
import type { Intent } from "@/lib/chatbot/types";

// Intents are selected by deterministic confidence score; registration order is the stable tie-breaker.
export const intents: Intent[] = [myGoalsIntent, myActivityIntent, recommendClassIntent, nowAndNextIntent, membersByAttributeIntent, myAppointmentsIntent, bookClassIntent, classInfoIntent, studioCapacityIntent, instructorClassesIntent, rosterSummaryIntent, whoIsBookedIntent, memberLookupIntent, workoutPlanIntent, timeOffReviewIntent, timeOffIntent, retentionLookupIntent, outreachDraftIntent, outreachSendIntent, helpIntent, scheduleIntent];
