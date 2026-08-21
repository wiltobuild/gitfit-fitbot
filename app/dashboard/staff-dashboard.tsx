import { fillLevel } from "@/lib/classes/fill-level";
import { getStudioDayStats } from "@/lib/classes/current-or-next";
import type { StudioClass } from "@/lib/classes/queries";

type BookingRateTrend = { thisWeekFillPercent: number; lastWeekFillPercent: number };

const formatDate = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", options).format(new Date(`${date}T00:00:00`));
const formatTime = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
};
const formatLocalDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const badgeClass = (classRow: StudioClass) => {
  const level = fillLevel(classRow.booked_count, classRow.capacity);
  return level === "full" ? "badge-danger" : level === "filling" ? "badge-warning" : "badge-success";
};

function StatTile({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <article className="surface-card dashboard-card staff-dashboard-stat"><p>{label}</p><strong>{value}</strong><span>{detail}</span></article>;
}

export function StaffDashboard({ classes, bookingRateTrend, instructorName }: { classes: StudioClass[]; bookingRateTrend: BookingRateTrend; instructorName: string | null }) {
  const now = new Date();
  const today = formatLocalDate(now);
  const mondayOffset = (now.getDay() + 6) % 7;
  const weekMonday = new Date(now);
  weekMonday.setDate(now.getDate() - mondayOffset);
  weekMonday.setHours(0, 0, 0, 0);
  const weekSunday = new Date(weekMonday);
  weekSunday.setDate(weekMonday.getDate() + 6);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const classesThisWeek = classes.filter((classRow) => classRow.class_date >= formatLocalDate(weekMonday) && classRow.class_date <= formatLocalDate(weekSunday));
  const classesThisMonth = classes.filter((classRow) => classRow.class_date <= formatLocalDate(monthEnd));
  const totalCapacity = classes.reduce((total, classRow) => total + classRow.capacity, 0);
  const totalBooked = classes.reduce((total, classRow) => total + classRow.booked_count, 0);
  const todayClasses = classes.filter((classRow) => classRow.class_date === today);
  const { currentClass, nextClass } = getStudioDayStats(todayClasses, now);
  const outlookEnd = new Date(now);
  outlookEnd.setDate(now.getDate() + 7);
  const outlook = classes.filter((classRow) => classRow.class_date <= formatLocalDate(outlookEnd));
  const outlookByDate = outlook.reduce<Record<string, StudioClass[]>>((result, classRow) => { (result[classRow.class_date] ??= []).push(classRow); return result; }, {});
  const typeMix = Object.entries(classes.reduce<Record<string, { booked: number; capacity: number; count: number }>>((result, classRow) => {
    const type = classRow.type || "Other";
    const entry = result[type] ?? { booked: 0, capacity: 0, count: 0 };
    entry.booked += classRow.booked_count;
    entry.capacity += classRow.capacity;
    entry.count += 1;
    result[type] = entry;
    return result;
  }, {})).map(([type, values]) => ({ type, count: values.count, fillPercent: values.capacity ? Math.round((values.booked / values.capacity) * 100) : 0 })).sort((a, b) => b.fillPercent - a.fillPercent);
  const trendDifference = bookingRateTrend.thisWeekFillPercent - bookingRateTrend.lastWeekFillPercent;
  const trendLabel = trendDifference > 0 ? "Up" : trendDifference < 0 ? "Down" : "Flat";
  const priorityClass = currentClass ?? nextClass;

  return <main className="staff-dashboard-content">
    <header className="staff-dashboard-header"><div><p className="eyebrow"><span /> Instructor view</p><h1>My dashboard</h1><p>{instructorName ? `Your classes, bookings, and schedule at a glance, ${instructorName}.` : "Your classes, bookings, and schedule at a glance."}</p></div><span className="badge badge-brand">Instructor</span></header>
    <section className="staff-dashboard-stats" aria-label="Instructor metrics"><StatTile label="Upcoming this week" value={classesThisWeek.length} detail="Classes you are hosting" /><StatTile label="Upcoming this month" value={classesThisMonth.length} detail="Classes still on your calendar" /><StatTile label="Upcoming bookings" value={`${totalBooked}/${totalCapacity}`} detail={totalCapacity ? `${Math.round((totalBooked / totalCapacity) * 100)}% of available spots` : "No upcoming capacity"} /><StatTile label="Current booking rate" value={`${bookingRateTrend.thisWeekFillPercent}%`} detail="Across this ISO week" /></section>
    <div className="staff-dashboard-grid">
      <section className="surface-card dashboard-card staff-dashboard-panel" aria-labelledby="my-classes-title"><div className="staff-dashboard-panel-heading"><div><p className="eyebrow"><span /> Your schedule</p><h2 id="my-classes-title">My classes</h2></div><span className="badge badge-neutral">{classes.length} upcoming</span></div>{classes.length ? <ul className="staff-class-list">{classes.map((classRow) => { const level = fillLevel(classRow.booked_count, classRow.capacity); const isPriority = classRow.id === priorityClass?.id; return <li className={`staff-class-row staff-fill-${level}${isPriority ? " staff-class-priority" : ""}`} key={classRow.id}><div className="staff-class-summary"><strong>{classRow.name}</strong><span>{formatDate(classRow.class_date, { weekday: "short", month: "short", day: "numeric" })} · {formatTime(classRow.start_time)}</span></div><div className="staff-fill-unit"><div className="staff-fill-label"><span className={`badge ${badgeClass(classRow)}`}>{level === "full" ? "Full" : level === "filling" ? "Filling" : "Healthy"}</span><strong>{classRow.booked_count}/{classRow.capacity}</strong></div><span className="staff-fill-track" aria-label={`${classRow.booked_count} of ${classRow.capacity} spots booked`}><span style={{ width: `${Math.min(100, classRow.capacity ? (classRow.booked_count / classRow.capacity) * 100 : 0)}%` }} /></span></div></li>; })}</ul> : <div className="empty-state staff-dashboard-empty"><h3>No upcoming classes</h3><p>Your upcoming classes will appear here when they are scheduled.</p></div>}</section>
      <aside className="staff-dashboard-side"><section className="surface-card dashboard-card staff-dashboard-panel"><div className="staff-dashboard-panel-heading"><div><p className="eyebrow"><span /> Today</p><h2>Current or next</h2></div></div>{priorityClass ? <div className="staff-dashboard-focus"><strong>{priorityClass.name}</strong><span>{currentClass ? "In progress now" : "Up next"} · {formatTime(priorityClass.start_time)}</span><small>{priorityClass.booked_count}/{priorityClass.capacity} spots booked</small></div> : <div className="empty-state staff-dashboard-compact-empty"><h3>No class today</h3><p>There is nothing on your schedule for the rest of today.</p></div>}</section><section className="surface-card dashboard-card staff-dashboard-panel"><div className="staff-dashboard-panel-heading"><div><p className="eyebrow"><span /> Week-over-week</p><h2>Booking rate</h2></div><span className={`badge ${trendDifference > 0 ? "badge-success" : trendDifference < 0 ? "badge-warning" : "badge-neutral"}`}>{trendLabel} {Math.abs(trendDifference)} pts</span></div><div className="staff-dashboard-rate"><strong>{bookingRateTrend.thisWeekFillPercent}%</strong><span>This week&apos;s booking rate</span><p>Last week: {bookingRateTrend.lastWeekFillPercent}%</p></div></section></aside>
    </div>
    <div className="staff-dashboard-grid staff-dashboard-secondary"><section className="surface-card dashboard-card staff-dashboard-panel" aria-labelledby="outlook-title"><div className="staff-dashboard-panel-heading"><div><p className="eyebrow"><span /> Near-term view</p><h2 id="outlook-title">Upcoming week outlook</h2></div><span className="badge badge-neutral">Next 7 days</span></div>{outlook.length ? <div className="staff-dashboard-days">{Object.entries(outlookByDate).map(([date, dayClasses]) => <div key={date}><h3>{formatDate(date, { weekday: "long", month: "short", day: "numeric" })}</h3><ul className="admin-session-list">{dayClasses.map((classRow) => <li key={classRow.id}><div><strong>{classRow.name}</strong><span>{formatTime(classRow.start_time)} · {classRow.type}</span></div><span className={`badge ${badgeClass(classRow)}`}>{classRow.booked_count}/{classRow.capacity}</span></li>)}</ul></div>)}</div> : <div className="empty-state staff-dashboard-compact-empty"><h3>No classes in the next seven days</h3><p>Your next scheduled class will appear here.</p></div>}</section><section className="surface-card dashboard-card staff-dashboard-panel" aria-labelledby="type-mix-title"><div className="staff-dashboard-panel-heading"><div><p className="eyebrow"><span /> Your class mix</p><h2 id="type-mix-title">Fill fastest</h2></div></div>{typeMix.length ? <ul className="staff-dashboard-type-list">{typeMix.map((entry) => <li key={entry.type}><div><strong>{entry.type}</strong><span>{entry.count} upcoming {entry.count === 1 ? "class" : "classes"}</span></div><b>{entry.fillPercent}%</b></li>)}</ul> : <div className="empty-state staff-dashboard-compact-empty"><h3>No class mix yet</h3><p>Class-type booking rates will appear once you have upcoming classes.</p></div>}</section></div>
  </main>;
}

export function StaffDashboardNotLinked() {
  return <main className="staff-dashboard-content"><section className="surface-card dashboard-card staff-dashboard-not-linked"><div className="empty-state"><h3>You&apos;re not linked to an instructor profile.</h3><p>Ask an admin to link your account before using the instructor dashboard.</p></div></section></main>;
}
