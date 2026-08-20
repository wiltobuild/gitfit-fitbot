// Client-safe: no Supabase/server imports. Client components (chat-experience.tsx,
// chatbot-overlay.tsx, staff pages) import ChipId/CHIP_LABELS from here, never from
// chips.ts directly, so their bundle never pulls in lib/supabase/server.ts (which
// needs next/headers, a server-only API).

export type ChipId = "quick-workout" | "plan-my-week" | "build-consistency" | "retention-outreach" | "time-off-coverage" | "pending-time-off" | "member-lookup" | "member-summary" | "my-goals" | "my-activity" | "todays-schedule" | "my-appointments" | "menu";

export const CHIP_LABELS: Record<ChipId, string> = { "quick-workout": "I need a quick workout", "plan-my-week": "Help me plan my week", "build-consistency": "How do I build consistency?", "retention-outreach": "Who needs re-engagement?", "time-off-coverage": "Help plan instructor coverage", "pending-time-off": "Show pending time-off requests", "member-lookup": "Look up a member", "member-summary": "Member summary", "my-goals": "Show my goals", "my-activity": "Show my activity", "todays-schedule": "What’s on today?", "my-appointments": "Show my appointments", "menu": "What can I ask?" };

export const CHIP_ROLES: Record<ChipId, Array<"client" | "staff" | "admin">> = { "quick-workout": ["client", "staff", "admin"], "plan-my-week": ["client", "staff", "admin"], "build-consistency": ["client", "staff", "admin"], "retention-outreach": ["staff", "admin"], "time-off-coverage": ["staff", "admin"], "pending-time-off": ["admin"], "member-lookup": ["staff", "admin"], "member-summary": ["staff", "admin"], "my-goals": ["client"], "my-activity": ["client"], "todays-schedule": ["client", "staff", "admin"], "my-appointments": ["client", "staff", "admin"], "menu": ["client", "staff", "admin"] };

export const CLIENT_MENU: ChipId[] = ["quick-workout", "plan-my-week", "build-consistency", "my-goals", "my-activity", "todays-schedule", "my-appointments", "menu"];
export const STAFF_MENU: ChipId[] = ["todays-schedule", "retention-outreach", "time-off-coverage", "member-lookup", "member-summary", "menu"];
export const ADMIN_MENU: ChipId[] = [...STAFF_MENU, "pending-time-off"];
