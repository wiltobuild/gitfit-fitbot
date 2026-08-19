import { helpIntent } from "@/lib/chatbot/intents/help";
import { scheduleIntent } from "@/lib/chatbot/intents/schedule";
import type { Intent } from "@/lib/chatbot/types";

export const intents: Intent[] = [helpIntent, scheduleIntent];
