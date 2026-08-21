export type ChipId =
  | "quick-workout" | "plan-my-week" | "build-consistency" | "retention-outreach"
  | "time-off-coverage" | "pending-time-off" | "studio-capacity" | "instructor-classes"
  | "roster-summary" | "member-lookup" | "member-summary" | "my-goals" | "my-activity"
  | "todays-schedule" | "my-appointments" | "recommend-class" | "whats-next" | "menu";

export const CHIP_LABELS: Record<ChipId, string> = {
  "quick-workout": "I need a quick workout", "plan-my-week": "Help me plan my week", "build-consistency": "How do I build consistency?", "retention-outreach": "Who needs re-engagement?", "time-off-coverage": "Help plan instructor coverage", "pending-time-off": "Show pending time-off requests", "studio-capacity": "Show today's capacity", "instructor-classes": "Look up an instructor's classes", "roster-summary": "Roster summary", "member-lookup": "Look up a member", "member-summary": "Member summary", "my-goals": "Show my goals", "my-activity": "Show my activity", "todays-schedule": "What's on today?", "my-appointments": "Show my appointments", "recommend-class": "What should I book?", "whats-next": "What's happening now?", "menu": "What can I ask?"
};

export const CHIP_ROLES: Record<ChipId, Array<"client" | "staff" | "admin">> = {
  "quick-workout": ["client", "staff", "admin"], "plan-my-week": ["client", "staff", "admin"], "build-consistency": ["client", "staff", "admin"], "retention-outreach": ["staff", "admin"], "time-off-coverage": ["staff", "admin"], "pending-time-off": ["admin"], "studio-capacity": ["staff", "admin"], "instructor-classes": ["client", "staff", "admin"], "roster-summary": ["staff", "admin"], "member-lookup": ["staff", "admin"], "member-summary": ["staff", "admin"], "my-goals": ["client"], "my-activity": ["client"], "todays-schedule": ["client", "staff", "admin"], "my-appointments": ["client", "staff", "admin"], "recommend-class": ["client"], "whats-next": ["client", "staff", "admin"], "menu": ["client", "staff", "admin"]
};

export const CLIENT_MENU: ChipId[] = ["quick-workout", "plan-my-week", "build-consistency", "instructor-classes", "my-goals", "my-activity", "todays-schedule", "my-appointments", "recommend-class", "whats-next", "menu"];
export const STAFF_MENU: ChipId[] = ["todays-schedule", "whats-next", "studio-capacity", "instructor-classes", "roster-summary", "retention-outreach", "time-off-coverage", "member-lookup", "member-summary", "menu"];
export const ADMIN_MENU: ChipId[] = [...STAFF_MENU, "pending-time-off"];
