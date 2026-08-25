const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday"
] as const;
const INSTRUCTORS = ["sofia martinez", "marcus lee", "avery thompson"] as const;
const CLASS_TYPES = ["yoga", "cycling", "hiit", "boxing", "pilates", "strength"] as const;
const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december"
];
const hasWord = (message: string, word: string) =>
  new RegExp("\\b" + word + "\\b", "i").test(message);
const toDateString = (date: Date) =>
  date.getFullYear() +
  "-" +
  String(date.getMonth() + 1).padStart(2, "0") +
  "-" +
  String(date.getDate()).padStart(2, "0");

function levenshteinDistance(left: string, right: string) {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex++) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex++)
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] +
          Number(left[leftIndex - 1] !== right[rightIndex - 1])
      );
    previous = current;
  }
  return previous[right.length];
}

export function fuzzyMatch(
  input: string,
  candidates: string[]
): string | undefined {
  const normalizedInput = input.trim().toLowerCase();
  if (!normalizedInput) return undefined;
  const maximumDistance =
    normalizedInput.length <= 4 ? 0 : normalizedInput.length <= 7 ? 1 : 2;
  let match: string | undefined;
  let minimumDistance = Infinity;
  let isAmbiguous = false;

  for (const candidate of candidates) {
    const distance = levenshteinDistance(
      normalizedInput,
      candidate.trim().toLowerCase()
    );
    if (distance > maximumDistance || distance > minimumDistance) continue;
    if (distance < minimumDistance) {
      match = candidate;
      minimumDistance = distance;
      isAmbiguous = false;
    } else isAmbiguous = true;
  }

  return isAmbiguous ? undefined : match;
}

function messageWords(message: string) {
  return message.match(/[a-z0-9]+/gi) ?? [];
}
function resolveExplicitDate(message: string, today: Date) {
  const iso = message.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const [, year, month, day] = iso;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (
      date.getFullYear() === Number(year) &&
      date.getMonth() === Number(month) - 1 &&
      date.getDate() === Number(day)
    )
      return toDateString(date);
  }
  const numeric = message.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (numeric) {
    const [, month, day, year] = numeric;
    const resolvedYear = year
      ? Number(year.length === 2 ? "20" + year : year)
      : today.getFullYear();
    const date = new Date(resolvedYear, Number(month) - 1, Number(day));
    if (
      date.getFullYear() === resolvedYear &&
      date.getMonth() === Number(month) - 1 &&
      date.getDate() === Number(day)
    )
      return toDateString(date);
  }
  const named = message.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:,?\s+(\d{4}))?\b/i
  );
  if (!named) return undefined;
  const month = MONTHS.indexOf(named[1].toLowerCase());
  const year = named[3] ? Number(named[3]) : today.getFullYear();
  const date = new Date(year, month, Number(named[2]));
  return date.getFullYear() === year &&
    date.getMonth() === month &&
    date.getDate() === Number(named[2])
    ? toDateString(date)
    : undefined;
}
export function resolveDate(
  message: string,
  options: { fallbackToToday?: boolean } = {}
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const normalized = message.toLowerCase();
  const explicitDate = resolveExplicitDate(normalized, today);
  if (explicitDate) return explicitDate;
  if (options.fallbackToToday && hasWord(normalized, "tomorrow")) {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return toDateString(tomorrow);
  }
  if (hasWord(normalized, "today") || hasWord(normalized, "tonight"))
    return toDateString(today);
  if (hasWord(normalized, "tomorrow")) {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return toDateString(tomorrow);
  }
  const weekday = resolveWeekday(normalized);
  if (weekday) {
    const date = new Date(today);
    date.setDate(
      today.getDate() + ((WEEKDAYS.indexOf(weekday) - today.getDay() + 7) % 7)
    );
    return toDateString(date);
  }
  return options.fallbackToToday ? toDateString(today) : undefined;
}
export function resolveTime(message: string) {
  const match = message.match(
    /\b(\d{1,2})(?::(\d{2}))?\s*(a\.?(?:m\.?)|p\.?(?:m\.?))\b/i
  );
  if (!match) return undefined;
  let hours = Number(match[1]);
  if (hours === 12) hours = 0;
  if (match[3].toLowerCase().startsWith("p")) hours += 12;
  return (
    String(hours).padStart(2, "0") +
    ":" +
    String(Number(match[2] ?? 0)).padStart(2, "0")
  );
}
export function resolveInstructor(message: string) {
  const normalized = message.toLowerCase();
  const exactMatch = INSTRUCTORS.find((instructor) =>
    instructor.split(" ").some((name) => hasWord(normalized, name))
  );
  if (exactMatch) return exactMatch;
  const names = INSTRUCTORS.flatMap((instructor) => instructor.split(" "));
  for (const word of messageWords(normalized)) {
    const matchedName = fuzzyMatch(word, names);
    if (matchedName)
      return INSTRUCTORS.find((instructor) =>
        instructor.split(" ").includes(matchedName)
      )!;
  }
  return undefined;
}
export function resolveClassType(message: string) {
  const exactMatch = CLASS_TYPES.find((type) => hasWord(message, type));
  if (exactMatch) return exactMatch;
  for (const word of messageWords(message)) {
    const matchedType = fuzzyMatch(word, [...CLASS_TYPES]);
    if (matchedType) return matchedType as (typeof CLASS_TYPES)[number];
  }
  return undefined;
}
export function resolveWeekday(message: string) {
  const exactMatch = WEEKDAYS.find((weekday) => hasWord(message, weekday));
  if (exactMatch) return exactMatch;
  for (const word of messageWords(message)) {
    const matchedWeekday = fuzzyMatch(word, [...WEEKDAYS]);
    if (matchedWeekday) return matchedWeekday as (typeof WEEKDAYS)[number];
  }
  return undefined;
}
