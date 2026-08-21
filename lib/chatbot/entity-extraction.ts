const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
const INSTRUCTORS = ["sofia martinez", "marcus lee", "avery thompson"] as const;
const CLASS_TYPES = ["yoga", "cycling", "hiit"] as const;
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const hasWord = (message: string, word: string) => new RegExp("\\b" + word + "\\b", "i").test(message);
const toDateString = (date: Date) => date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
function resolveExplicitDate(message: string, today: Date) {
  const numeric = message.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (numeric) { const [, month, day, year] = numeric; const resolvedYear = year ? Number(year.length === 2 ? "20" + year : year) : today.getFullYear(); const date = new Date(resolvedYear, Number(month) - 1, Number(day)); if (date.getFullYear() === resolvedYear && date.getMonth() === Number(month) - 1 && date.getDate() === Number(day)) return toDateString(date); }
  const named = message.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:,?\s+(\d{4}))?\b/i);
  if (!named) return undefined;
  const month = MONTHS.indexOf(named[1].toLowerCase()); const year = named[3] ? Number(named[3]) : today.getFullYear(); const date = new Date(year, month, Number(named[2]));
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === Number(named[2]) ? toDateString(date) : undefined;
}
export function resolveDate(message: string, options: { fallbackToToday?: boolean } = {}) {
  const today = new Date(); today.setHours(0, 0, 0, 0); const normalized = message.toLowerCase(); const explicitDate = resolveExplicitDate(normalized, today);
  if (explicitDate) return explicitDate;
  if (options.fallbackToToday && hasWord(normalized, "tomorrow")) { const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1); return toDateString(tomorrow); }
  if (hasWord(normalized, "today") || hasWord(normalized, "tonight")) return toDateString(today);
  if (hasWord(normalized, "tomorrow")) { const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1); return toDateString(tomorrow); }
  const weekday = resolveWeekday(normalized);
  if (weekday) { const date = new Date(today); date.setDate(today.getDate() + ((WEEKDAYS.indexOf(weekday) - today.getDay() + 7) % 7)); return toDateString(date); }
  return options.fallbackToToday ? toDateString(today) : undefined;
}
export function resolveTime(message: string) { const match = message.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?(?:m\.?)|p\.?(?:m\.?))\b/i); if (!match) return undefined; let hours = Number(match[1]); if (hours === 12) hours = 0; if (match[3].toLowerCase().startsWith("p")) hours += 12; return String(hours).padStart(2, "0") + ":" + String(Number(match[2] ?? 0)).padStart(2, "0"); }
export function resolveInstructor(message: string) { const normalized = message.toLowerCase(); return INSTRUCTORS.find((instructor) => instructor.split(" ").some((name) => hasWord(normalized, name))); }
export function resolveClassType(message: string) { return CLASS_TYPES.find((type) => hasWord(message, type)); }
export function resolveWeekday(message: string) { return WEEKDAYS.find((weekday) => hasWord(message, weekday)); }
