"use client";

import { useState } from "react";

export type ScheduleAttendee = { userId: string; name: string | null; email: string | null };
export type ScheduleClass = {
  id: string;
  name: string;
  type: string;
  class_date: string;
  start_time: string;
  capacity: number;
  booked_count: number;
  attendees: ScheduleAttendee[];
};

function formatDay(date: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" }).format(new Date(`${date}T12:00:00`));
}
function formatTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
}
function fillLevel(booked: number, capacity: number) {
  const ratio = capacity ? booked / capacity : 0;
  return ratio >= 1 ? "full" : ratio >= 0.8 ? "filling" : "healthy";
}

export function MySchedule({ classes, pendingRequestTypeByClassId }: { classes: ScheduleClass[]; pendingRequestTypeByClassId: Record<string, "swap" | "cancel"> }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionState, setActionState] = useState<{ id: string; type: "swap" | "cancel" } | null>(null);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState<Record<string, "swap" | "cancel">>({});

  async function requestChange(classId: string, type: "swap" | "cancel") {
    setActionState({ id: classId, type });
    setError("");
    try {
      const response = await fetch("/api/staff/class-changes/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, type }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Unable to submit this request.");
      setSubmitted((current) => ({ ...current, [classId]: type }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to submit this request.");
    } finally {
      setActionState(null);
    }
  }

  const days = new Map<string, ScheduleClass[]>();
  for (const classRow of classes) {
    if (!days.has(classRow.class_date)) days.set(classRow.class_date, []);
    days.get(classRow.class_date)!.push(classRow);
  }

  return (
    <section className="surface-card staff-my-schedule" aria-labelledby="my-schedule-title">
      <div className="staff-panel-heading">
        <div>
          <p className="eyebrow"><span /> My schedule</p>
          <h2 id="my-schedule-title">Next 2 weeks</h2>
        </div>
        <p>{classes.length ? `${classes.length} classes` : "Nothing scheduled"}</p>
      </div>
      {error ? <p className="staff-search-error" aria-live="polite">{error}</p> : null}
      {classes.length === 0 ? (
        <div className="empty-state"><h3>No classes scheduled</h3><p>Your next two weeks are clear.</p></div>
      ) : (
        <div className="staff-schedule-days">
          {[...days.entries()].map(([date, dayClasses]) => (
            <div className="staff-schedule-day" key={date}>
              <p className="staff-schedule-day-heading">{formatDay(date)}</p>
              <ul className="staff-class-list">
                {dayClasses.map((classRow) => {
                  const level = fillLevel(classRow.booked_count, classRow.capacity);
                  const isExpanded = expandedId === classRow.id;
                  const requestedType = submitted[classRow.id] ?? pendingRequestTypeByClassId[classRow.id];
                  const isActing = actionState?.id === classRow.id;
                  return (
                    <li className="staff-schedule-class-group" key={classRow.id}>
                      <div className={`staff-class-row staff-fill-${level}`}>
                        <div className="staff-class-summary">
                          <strong>{classRow.name}</strong>
                          <span>{formatTime(classRow.start_time)} · {classRow.type}</span>
                        </div>
                        <div className="staff-fill-unit">
                          <div className="staff-fill-label">
                            <button type="button" className="staff-fitbot-text" onClick={() => setExpandedId(isExpanded ? null : classRow.id)}>
                              {classRow.booked_count}/{classRow.capacity} booked
                            </button>
                          </div>
                          <span className="staff-fill-track" aria-label={`${classRow.booked_count} of ${classRow.capacity} spots booked`}>
                            <span style={{ width: `${Math.min(100, classRow.capacity ? (classRow.booked_count / classRow.capacity) * 100 : 0)}%` }} />
                          </span>
                        </div>
                        <div className="staff-schedule-actions">
                          {requestedType ? (
                            <span className="badge badge-neutral">{requestedType} requested</span>
                          ) : (
                            <>
                              <button className="btn btn-outline-danger btn-sm" disabled={isActing} onClick={() => void requestChange(classRow.id, "cancel")} type="button">
                                {isActing && actionState.type === "cancel" ? "…" : "Cancel"}
                              </button>
                              <button className="btn btn-outline btn-sm" disabled={isActing} onClick={() => void requestChange(classRow.id, "swap")} type="button">
                                {isActing && actionState.type === "swap" ? "…" : "Swap"}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {isExpanded ? (
                        <div className="staff-schedule-roster" aria-label={`Attendees for ${classRow.name}`}>
                          {classRow.attendees.length ? (
                            <ul>
                              {classRow.attendees.map((attendee) => (
                                <li key={attendee.userId}>{attendee.name ?? attendee.email ?? "Member"}</li>
                              ))}
                            </ul>
                          ) : (
                            <p>No attendees booked yet.</p>
                          )}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
