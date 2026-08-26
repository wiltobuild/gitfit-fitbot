"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { ScheduleRow } from "@/app/components/schedule-row";

export type ScheduleAttendee = { userId: string; name: string | null; email: string | null };
export type ScheduleClass = {
  id: string;
  name: string;
  type: string;
  class_date: string;
  start_time: string;
  duration_minutes: number;
  capacity: number;
  booked_count: number;
};
type RosterState = { status: "loading" } | { status: "loaded"; attendees: ScheduleAttendee[] } | { status: "error" };
type EditFormValues = { name: string; type: string; classDate: string; startTime: string; durationMinutes: string; capacity: string };

function formatDayShort(date: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(new Date(`${date}T12:00:00`));
}
function formatDateShort(date: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${date}T12:00:00`));
}
function formatDayFull(date: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date(`${date}T12:00:00`));
}
function formatTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
}
function addDays(date: string, days: number) {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + days);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}

export function MySchedule({ classes, pendingRequestTypeByClassId, today }: { classes: ScheduleClass[]; pendingRequestTypeByClassId: Record<string, "edit" | "cancel">; today: string }) {
  const router = useRouter();
  const dates = useMemo(() => Array.from({ length: 14 }, (_, index) => addDays(today, index)), [today]);
  const [showSecondWeek, setShowSecondWeek] = useState(false);
  const [activeDate, setActiveDate] = useState(today);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rosterByClassId, setRosterByClassId] = useState<Record<string, RosterState>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [actionState, setActionState] = useState<{ id: string; type: "edit" | "cancel" } | null>(null);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState<Record<string, "edit" | "cancel">>({});

  const visibleDates = showSecondWeek ? dates : dates.slice(0, 7);
  const classesForDay = classes.filter((classRow) => classRow.class_date === activeDate);

  async function toggleRoster(classId: string) {
    if (expandedId === classId) { setExpandedId(null); return; }
    setExpandedId(classId);
    if (rosterByClassId[classId]) return;
    setRosterByClassId((current) => ({ ...current, [classId]: { status: "loading" } }));
    try {
      const response = await fetch(`/api/staff/classes/${classId}/roster`);
      if (!response.ok) throw new Error("Unable to load roster");
      const data = (await response.json()) as { attendees: ScheduleAttendee[] };
      setRosterByClassId((current) => ({ ...current, [classId]: { status: "loaded", attendees: data.attendees } }));
    } catch {
      setRosterByClassId((current) => ({ ...current, [classId]: { status: "error" } }));
    }
  }

  async function requestCancel(classId: string) {
    setActionState({ id: classId, type: "cancel" });
    setError("");
    try {
      const response = await fetch("/api/staff/class-changes/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, requestType: "cancel" }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Unable to submit this request.");
      setSubmitted((current) => ({ ...current, [classId]: "cancel" }));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to submit this request.");
    } finally {
      setActionState(null);
    }
  }

  async function submitEdit(classId: string, values: EditFormValues) {
    const response = await fetch("/api/staff/class-changes/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classId,
        requestType: "edit",
        proposedClass: {
          name: values.name,
          type: values.type,
          classDate: values.classDate,
          startTime: values.startTime,
          durationMinutes: Number(values.durationMinutes),
          capacity: Number(values.capacity),
        },
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    if (!response.ok) throw new Error(payload.error?.message ?? "Unable to submit this edit.");
    setSubmitted((current) => ({ ...current, [classId]: "edit" }));
    setEditingId(null);
    router.refresh();
  }

  return (
    <section className="surface-card staff-my-schedule" aria-labelledby="my-schedule-title">
      <div className="staff-panel-heading">
        <div>
          <p className="eyebrow"><span /> My schedule</p>
          <h2 id="my-schedule-title">{formatDayFull(activeDate)}</h2>
        </div>
        <p>{classes.length ? `${classes.length} classes over 2 weeks` : "Nothing scheduled"}</p>
      </div>
      <div className="staff-schedule-day-tabs" aria-label="Class dates">
        {visibleDates.map((date) => {
          const count = classes.filter((classRow) => classRow.class_date === date).length;
          return (
            <button aria-pressed={date === activeDate} className={`staff-schedule-day-tab${date === activeDate ? " active" : ""}`} key={date} onClick={() => setActiveDate(date)} type="button">
              <small>{formatDayShort(date)}</small>
              <strong>{formatDateShort(date)}</strong>
              <span>{count} {count === 1 ? "class" : "classes"}</span>
            </button>
          );
        })}
      </div>
      <button className="btn btn-ghost staff-schedule-expand-toggle" onClick={() => setShowSecondWeek((current) => !current)} type="button">{showSecondWeek ? "Show this week only" : "Show next week too"}</button>
      {error ? <p className="staff-search-error" aria-live="polite">{error}</p> : null}
      {classesForDay.length === 0 ? (
        <div className="empty-state"><h3>No classes this day</h3><p>Pick another day above to see what&apos;s scheduled.</p></div>
      ) : (
        <ul className="staff-class-list">
          {classesForDay.map((classRow) => {
            const isExpanded = expandedId === classRow.id;
            const isEditing = editingId === classRow.id;
            const roster = rosterByClassId[classRow.id];
            const requestedType = submitted[classRow.id] ?? pendingRequestTypeByClassId[classRow.id];
            const isActing = actionState?.id === classRow.id;
            return (
              <li className="staff-schedule-class-group" key={classRow.id}>
                {isEditing ? (
                  <EditClassForm
                    initial={{ name: classRow.name, type: classRow.type, classDate: classRow.class_date, startTime: classRow.start_time.slice(0, 5), durationMinutes: String(classRow.duration_minutes), capacity: String(classRow.capacity) }}
                    onCancel={() => setEditingId(null)}
                    onSubmit={(values) => submitEdit(classRow.id, values)}
                  />
                ) : (
                  <ScheduleRow
                    as="div"
                    name={classRow.name}
                    meta={<span>{formatTime(classRow.start_time)} · {classRow.type}</span>}
                    capacity={{ booked: classRow.booked_count, capacity: classRow.capacity }}
                    capacityLabel={
                      <button type="button" className="staff-fitbot-text" onClick={() => void toggleRoster(classRow.id)}>
                        {classRow.booked_count}/{classRow.capacity} booked
                      </button>
                    }
                    actions={requestedType ? (
                      <span className="badge badge-neutral">{requestedType} requested</span>
                    ) : (
                      <>
                        <button className="btn btn-outline-danger btn-sm" disabled={isActing} onClick={() => void requestCancel(classRow.id)} type="button">
                          {isActing && actionState.type === "cancel" ? "…" : "Cancel"}
                        </button>
                        <button className="btn btn-outline btn-sm" disabled={isActing} onClick={() => setEditingId(classRow.id)} type="button">
                          Edit
                        </button>
                      </>
                    )}
                  />
                )}
                {isExpanded && !isEditing ? (
                  <div className="staff-schedule-roster" aria-label={`Attendees for ${classRow.name}`}>
                    {!roster || roster.status === "loading" ? (
                      <p>Loading attendees…</p>
                    ) : roster.status === "error" ? (
                      <p>Unable to load attendees right now.</p>
                    ) : roster.attendees.length ? (
                      <ul>
                        {roster.attendees.map((attendee) => (
                          <li key={attendee.userId}>{attendee.name ?? attendee.email ?? "Member"}</li>
                        ))}
                      </ul>
                    ) : classRow.booked_count > 0 ? (
                      <p>{classRow.booked_count} {classRow.booked_count === 1 ? "spot is" : "spots are"} booked, but no attendee records are on file for this class.</p>
                    ) : (
                      <p>No attendees booked yet.</p>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function EditClassForm({ initial, onCancel, onSubmit }: { initial: EditFormValues; onCancel: () => void; onSubmit: (values: EditFormValues) => Promise<void> }) {
  const [values, setValues] = useState(initial);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      await onSubmit(values);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to submit this edit.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="staff-class-form" onSubmit={handleSubmit}>
      <div className="staff-class-form-grid">
        <div className="field"><label className="field-label" htmlFor="edit-class-name">Class name</label><input className="field-input" id="edit-class-name" type="text" value={values.name} onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))} required /></div>
        <div className="field"><label className="field-label" htmlFor="edit-class-type">Type</label><input className="field-input" id="edit-class-type" type="text" list="edit-class-type-options" value={values.type} onChange={(event) => setValues((current) => ({ ...current, type: event.target.value }))} required />
          <datalist id="edit-class-type-options"><option value="Yoga" /><option value="Cycling" /><option value="HIIT" /><option value="Pilates" /><option value="Boxing" /><option value="Strength" /></datalist>
        </div>
        <div className="field"><label className="field-label" htmlFor="edit-class-date">Date</label><input className="field-input" id="edit-class-date" type="date" value={values.classDate} onChange={(event) => setValues((current) => ({ ...current, classDate: event.target.value }))} required /></div>
        <div className="field"><label className="field-label" htmlFor="edit-class-time">Start time</label><input className="field-input" id="edit-class-time" type="time" value={values.startTime} onChange={(event) => setValues((current) => ({ ...current, startTime: event.target.value }))} required /></div>
        <div className="field"><label className="field-label" htmlFor="edit-class-duration">Duration (min)</label><input className="field-input" id="edit-class-duration" type="number" min={1} value={values.durationMinutes} onChange={(event) => setValues((current) => ({ ...current, durationMinutes: event.target.value }))} required /></div>
        <div className="field"><label className="field-label" htmlFor="edit-class-capacity">Capacity</label><input className="field-input" id="edit-class-capacity" type="number" min={1} value={values.capacity} onChange={(event) => setValues((current) => ({ ...current, capacity: event.target.value }))} required /></div>
      </div>
      {error ? <p className="field-error" aria-live="polite">{error}</p> : null}
      <p className="field-hint">This goes to your manager for approval before it takes effect.</p>
      <div className="staff-class-form-actions">
        <button className="btn btn-outline btn-sm" type="button" onClick={onCancel} disabled={isSubmitting}>Cancel</button>
        <button className="btn btn-primary btn-sm" type="submit" disabled={isSubmitting}>{isSubmitting ? "Submitting…" : "Submit for approval"}</button>
      </div>
    </form>
  );
}
