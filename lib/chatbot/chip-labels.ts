// Client-safe: no Supabase/server imports. Client components (chat-experience.tsx,
// chatbot-overlay.tsx, staff pages) import ChipId/CHIP_LABELS from here, never from
// chips.ts directly, so their bundle never pulls in lib/supabase/server.ts (which
// needs next/headers, a server-only API).

export type ChipId = "quick-workout" | "plan-my-week" | "build-consistency" | "retention-outreach" | "time-off-coverage" | "member-lookup" | "member-summary" | "my-goals" | "my-activity" | "todays-schedule" | "my-appointments" | "menu";

export const CHIP_LABELS: Record<ChipId, string> = { "quick-workout": "I need a quick workout", "plan-my-week": "Help me plan my week", "build-consistency": "How do I build consistency?", "retention-outreach": "Who needs re-engagement?", "time-off-coverage": "Help plan instructor coverage", "member-lookup": "Look up a member", "member-summary": "Member summary", "my-goals": "Show my goals", "my-activity": "Show my activity", "todays-schedule": "What’s on today?", "my-appointments": "Show my appointments", "menu": "What can I ask?" };

export const CLIENT_MENU: ChipId[] = ["quick-workout", "plan-my-week", "build-consistency", "my-goals", "my-activity", "todays-schedule", "my-appointments", "menu"];
export const STAFF_MENU: ChipId[] = ["todays-schedule", "retention-outreach", "time-off-coverage", "member-lookup", "member-summary", "menu"];
