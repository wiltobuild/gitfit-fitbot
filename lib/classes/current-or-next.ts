type TimedClass = {
  start_time: string;
  duration_minutes: number;
};

export function isCurrentOrNext(classRow: TimedClass, now: Date) {
  const [hours, minutes] = classRow.start_time.split(":").map(Number);
  const startsAt = new Date(now);
  startsAt.setHours(hours, minutes, 0, 0);
  const endsAt = new Date(startsAt.getTime() + classRow.duration_minutes * 60_000);
  return now >= startsAt && now < endsAt;
}
