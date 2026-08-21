type TimedClass = {
  start_time: string;
  duration_minutes: number;
};

type StudioDayClass = TimedClass & {
  capacity: number;
  booked_count: number;
};

export function isCurrentOrNext(classRow: TimedClass, now: Date) {
  const [hours, minutes] = classRow.start_time.split(":").map(Number);
  const startsAt = new Date(now);
  startsAt.setHours(hours, minutes, 0, 0);
  const endsAt = new Date(startsAt.getTime() + classRow.duration_minutes * 60_000);
  return now >= startsAt && now < endsAt;
}

export function getStudioDayStats<T extends StudioDayClass>(classes: T[], now: Date) {
  const totalCapacity = classes.reduce((total, classRow) => total + classRow.capacity, 0);
  const totalBooked = classes.reduce((total, classRow) => total + classRow.booked_count, 0);
  const bookedPercent = totalCapacity ? Math.round((totalBooked / totalCapacity) * 100) : 0;
  const currentClass = classes.find((classRow) => isCurrentOrNext(classRow, now));
  const nextClass = currentClass ? undefined : classes.find((classRow) => {
    const [hours, minutes] = classRow.start_time.split(":").map(Number);
    return hours * 60 + minutes >= now.getHours() * 60 + now.getMinutes();
  });

  return { totalCapacity, totalBooked, bookedPercent, currentClass, nextClass };
}
