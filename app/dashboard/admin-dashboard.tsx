"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { approveTimeOffRequest, denyTimeOffRequest } from "@/app/actions/time-off";
import { fillLevel } from "@/lib/classes/fill-level";
import type { StudioClass } from "@/lib/classes/queries";
import type { PendingTimeOffRequest } from "@/lib/time-off/queries";

type AdminStats = {
  weeklyFillRate: number;
  lifecycleCounts: Record<string, number>;
  tierCounts: Record<string, number>;
  reengagementCount: number;
  pendingTimeOffCount: number;
};

const formatDate = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", options).format(new Date(`${date}T00:00:00`));
const formatTime = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
};
const fillBadge = (classRow: StudioClass) => {
  const level = fillLevel(classRow.booked_count, classRow.capacity);
  return level === "full" ? "badge-danger" : level === "filling" ? "badge-warning" : "badge-success";
};
const count = (counts: Record<string, number>, key: string) => counts[key] ?? 0;

function StatTile({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <article className="surface-card dashboard-card admin-stat-tile"><p>{label}</p><strong>{value}</strong><span>{detail}</span></article>;
}

function RequestsOffPanel({ initialRequests, count: initialCount }: { initialRequests: PendingTimeOffRequest[]; count: number }) {
  const router = useRouter();
  const [requests, setRequests] = useState(initialRequests);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const count = requests.length === initialRequests.length ? initialCount : requests.length;
  const review = (id: string, decision: "approve" | "deny") => {
    setError("");
    setPendingId(id);
    startTransition(async () => {
      const result = decision === "approve" ? await approveTimeOffRequest(id) : await denyTimeOffRequest(id);
      if (!result.ok) setError(result.error ?? "Unable to update this request.");
      else {
        setRequests((current) => current.filter((request) => request.id !== id));
        router.refresh();
      }
      setPendingId(null);
    });
  };
  return <section className="surface-card dashboard-card admin-panel" aria-labelledby="requests-off-title">
    <div className="admin-panel-heading"><div><p className="eyebrow"><span /> Team availability</p><h2 id="requests-off-title">Requests off</h2></div><span className="badge badge-brand">{count} pending</span></div>
    {error ? <p className="card-error" role="alert">{error}</p> : null}
    {requests.length ? <ul className="admin-request-list">{requests.map((request) => <li key={request.id}><div><strong>{request.full_name || "Staff member"}</strong><span>{formatDate(request.requested_date, { weekday: "short", month: "short", day: "numeric" })}</span>{request.reason ? <small>{request.reason}</small> : null}</div><div className="admin-request-actions"><button className="btn btn-primary btn-sm" disabled={isPending} onClick={() => review(request.id, "approve")} type="button">{pendingId === request.id ? "Saving..." : "Approve"}</button><button className="btn btn-outline btn-sm" disabled={isPending} onClick={() => review(request.id, "deny")} type="button">Deny</button></div></li>)}</ul> : <div className="empty-state admin-compact-empty"><h3>No pending requests</h3><p>Time-off requests needing review will appear here.</p></div>}
  </section>;
}

function Calendar({ classes, year, month }: { classes: StudioClass[]; year: number; month: number }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const byDate = useMemo(() => classes.reduce<Record<string, StudioClass[]>>((result, classRow) => { (result[classRow.class_date] ??= []).push(classRow); return result; }, {}), [classes]);
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const selectedClasses = selectedDate ? byDate[selectedDate] ?? [] : [];
  const monthName = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
  return <section className="surface-card dashboard-card admin-calendar-panel" aria-labelledby="admin-calendar-title">
    <div className="admin-panel-heading"><div><p className="eyebrow"><span /> Studio schedule</p><h2 id="admin-calendar-title">{monthName}</h2></div><span className="badge badge-neutral">{classes.length} sessions</span></div>
    <div className="admin-calendar" role="grid" aria-label={`${monthName} class calendar`}><div className="admin-calendar-weekdays" aria-hidden="true">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}</div><div className="admin-calendar-grid">{Array.from({ length: firstWeekday }, (_, index) => <div className="admin-calendar-blank" key={`blank-${index}`} />)}{Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayClasses = byDate[date] ?? [];
      return <button aria-pressed={selectedDate === date} className={`admin-calendar-day${selectedDate === date ? " selected" : ""}`} key={date} onClick={() => setSelectedDate(date)} type="button"><span className="admin-calendar-date">{day}</span>{dayClasses.slice(0, 3).map((classRow) => <span className={`admin-calendar-chip ${fillBadge(classRow)}`} key={classRow.id}>{formatTime(classRow.start_time)} {classRow.name}</span>)}{dayClasses.length > 3 ? <span className="admin-calendar-more">+{dayClasses.length - 3} more</span> : null}</button>;
    })}</div></div>
    {selectedDate ? <div className="admin-day-detail" aria-live="polite"><div><h3>{formatDate(selectedDate, { weekday: "long", month: "long", day: "numeric" })}</h3><p>{selectedClasses.length ? `${selectedClasses.length} sessions scheduled` : "No sessions scheduled"}</p></div>{selectedClasses.length ? <ul>{selectedClasses.map((classRow) => <li key={classRow.id}><span className={`badge ${fillBadge(classRow)}`}>{formatTime(classRow.start_time)}</span><strong>{classRow.name}</strong><span>{classRow.instructor} · {classRow.booked_count}/{classRow.capacity} booked</span></li>)}</ul> : null}</div> : null}
  </section>;
}

export function AdminDashboard({ userEmail, stats, upcomingClasses, monthClasses, pendingRequests, year, month }: { userEmail?: string; stats: AdminStats; upcomingClasses: StudioClass[]; monthClasses: StudioClass[]; pendingRequests: PendingTimeOffRequest[]; year: number; month: number }) {
  const upcomingByDate = useMemo(() => upcomingClasses.reduce<Record<string, StudioClass[]>>((result, classRow) => { (result[classRow.class_date] ??= []).push(classRow); return result; }, {}), [upcomingClasses]);
  return <main className="admin-dashboard-content"><header className="admin-dashboard-header"><div><p className="eyebrow"><span /> Studio operations</p><h1>Admin dashboard</h1><p>See the schedule, member health, and staffing decisions in one place.</p></div><span className="badge badge-brand">{userEmail || "Administrator"}</span></header><section className="admin-stat-grid" aria-label="Studio metrics"><StatTile label="Weekly fill rate" value={`${stats.weeklyFillRate}%`} detail="Across this ISO week" /><StatTile label="Member lifecycle" value={`${count(stats.lifecycleCounts, "active")} active`} detail={`${count(stats.lifecycleCounts, "at_risk")} at risk · ${count(stats.lifecycleCounts, "lapsed")} lapsed`} /><StatTile label="Membership tiers" value={`${count(stats.tierCounts, "basic")} basic`} detail={`${count(stats.tierCounts, "premium")} premium`} /><StatTile label="Needs re-engagement" value={stats.reengagementCount} detail="At-risk and lapsed members" /><StatTile label="Pending time off" value={stats.pendingTimeOffCount} detail="Requests awaiting review" /></section><div className="admin-dashboard-panels"><section className="surface-card dashboard-card admin-panel" aria-labelledby="upcoming-sessions-title"><div className="admin-panel-heading"><div><p className="eyebrow"><span /> Near-term view</p><h2 id="upcoming-sessions-title">Upcoming sessions</h2></div><span className="badge badge-neutral">Next 7 days</span></div>{upcomingClasses.length ? <div className="admin-upcoming-days">{Object.entries(upcomingByDate).map(([date, dayClasses]) => <div key={date}><h3>{formatDate(date, { weekday: "long", month: "short", day: "numeric" })}</h3><ul className="admin-session-list">{dayClasses.map((classRow) => <li key={classRow.id}><div><strong>{classRow.name}</strong><span>{formatTime(classRow.start_time)} · {classRow.instructor}</span></div><span className={`badge ${fillBadge(classRow)}`}>{classRow.booked_count}/{classRow.capacity}</span></li>)}</ul></div>)}</div> : <div className="empty-state admin-compact-empty"><h3>No upcoming sessions</h3><p>The next seven days are clear.</p></div>}</section><RequestsOffPanel count={stats.pendingTimeOffCount} initialRequests={pendingRequests} /></div><Calendar classes={monthClasses} month={month} year={year} /></main>;
}
