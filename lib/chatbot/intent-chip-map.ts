import type { ChipId } from "@/lib/chatbot/chip-labels";

export const INTENT_CHIP_MAP: Partial<Record<string, ChipId>> = {
  "my-activity": "my-activity",
  "roster-summary": "roster-summary",
  "instructor-classes": "instructor-classes",
  "studio-capacity": "studio-capacity",
  "member-lookup": "member-lookup",
  "my-appointments": "my-appointments",
  "recommend-class": "recommend-class",
  "now-and-next": "whats-next",
  "retention-lookup": "retention-outreach",
  schedule: "todays-schedule"
};
