export type EncouragingMessageInput = {
  streakWeeks: number;
  currentWeekBooked: boolean;
  hasAnyHistory: boolean;
  userId: string;
  today: string;
};

export type EncouragingMessageCategory = keyof typeof messages;

const messages = {
  "no-streak-yet": [
    "Your next session is the start of something great. Pick a class that sounds fun and let’s get moving.",
    "Every routine starts with one booking. Your first GitFit session is waiting whenever you are.",
    "Small starts count. Choose a class that fits your week and make some time for yourself.",
    "Ready for your first win? Book a session and give your momentum somewhere to begin."
  ],
  "streak-active-this-week-booked": [
    "This week is on the board—beautiful work keeping your rhythm going.",
    "You’ve already made space for movement this week. That consistency adds up.",
    "Streak protected and a session ahead. Keep enjoying the momentum you’re building.",
    "Your week has a workout in it already. That’s a strong way to keep your routine rolling."
  ],
  "streak-active-this-week-not-yet-booked": [
    "Your streak has a solid foundation. A booking this week can keep that rhythm going.",
    "You’ve built real consistency—when you’re ready, choose a session for this week to continue it.",
    "There’s still plenty of time to add a class this week and carry your momentum forward.",
    "Your completed-week streak is going strong. Find a class that feels good for this week."
  ],
  "streak-just-broken": [
    "Fresh starts are part of every routine. One session this week is a great place to begin again.",
    "Your momentum is always ready to restart. Pick a class that makes getting back in feel good.",
    "No pressure—just your next chance to move. A new streak can start with one booking.",
    "Routines have seasons. When you’re ready, your next session can be the first step forward."
  ]
} as const;

export function hashString(input: string): number {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) hash = (hash * 33) ^ input.charCodeAt(index);
  return hash >>> 0;
}

export function getEncouragingMessage({ streakWeeks, currentWeekBooked, hasAnyHistory, userId, today }: EncouragingMessageInput): { message: string; category: EncouragingMessageCategory } {
  const category = !hasAnyHistory
    ? "no-streak-yet"
    : streakWeeks > 0 && currentWeekBooked
      ? "streak-active-this-week-booked"
      : streakWeeks > 0
        ? "streak-active-this-week-not-yet-booked"
        : "streak-just-broken";
  const pool = messages[category];
  return { message: pool[hashString(`${userId}${today}`) % pool.length], category };
}
