import { helpIntent } from "@/lib/chatbot/intents/help";
import { scheduleIntent } from "@/lib/chatbot/intents/schedule";
import { myAppointmentsIntent } from "@/lib/chatbot/intents/my-appointments";
import { bookClassIntent } from "@/lib/chatbot/intents/book-class";
import { whoIsBookedIntent } from "@/lib/chatbot/intents/who-is-booked";
import type { Intent } from "@/lib/chatbot/types";

export const intents: Intent[] = [helpIntent, myAppointmentsIntent, bookClassIntent, whoIsBookedIntent, scheduleIntent];
