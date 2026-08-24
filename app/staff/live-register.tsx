"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { InstructorAvatar } from "@/app/components/instructor-avatar";

export type RegisterClass = {
  id: string;
  name: string;
  type: string;
  instructor: string;
  instructor_member_id: string | null;
  class_date: string;
  start_time: string;
  duration_minutes: number;
  capacity: number;
  booked_count: number;
  promoted: boolean;
};

export type InstructorOption = { id: string; full_name: string | null };

function formatTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
}
function fillLevel(booked: number, capacity: number) {
  const ratio = capacity ? booked / capacity : 0;
  return ratio >= 1 ? "full" : ratio >= 0.8 ? "filling" : "healthy";
}
// "Underbooked" per the shared suite vocabulary: booked ÷ capacity < 45%.
function isUnderbooked(booked: number, capacity: number) {
  return capacity > 0 && booked / capacity < 0.45;
}

type FormValues = { name: string; type: string; instructorMemberId: string; classDate: string; startTime: string; durationMinutes: string; capacity: string };
const emptyForm = (defaultDate: string): FormValues => ({ name: "", type: "", instructorMemberId: "", classDate: defaultDate, startTime: "", durationMinutes: "45", capacity: "16" });

function ClassForm({ instructors, initial, submitLabel, onCancel, onSubmit }: { instructors: InstructorOption[]; initial: FormValues; submitLabel: string; onCancel: () => void; onSubmit: (values: FormValues) => Promise<void> }) {
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
      setError(caught instanceof Error ? caught.message : "Unable to save this class.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="staff-class-form" onSubmit={handleSubmit}>
      <div className="staff-class-form-grid">
        <div className="field"><label className="field-label" htmlFor="class-name">Class name</label><input className="field-input" id="class-name" type="text" value={values.name} onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))} required /></div>
        <div className="field"><label className="field-label" htmlFor="class-type">Type</label><input className="field-input" id="class-type" type="text" list="class-type-options" value={values.type} onChange={(event) => setValues((current) => ({ ...current, type: event.target.value }))} required />
          <datalist id="class-type-options"><option value="Yoga" /><option value="Cycling" /><option value="HIIT" /><option value="Pilates" /><option value="Boxing" /><option value="Strength" /></datalist>
        </div>
        <div className="field"><label className="field-label" htmlFor="class-instructor">Instructor</label><select className="field-input" id="class-instructor" value={values.instructorMemberId} onChange={(event) => setValues((current) => ({ ...current, instructorMemberId: event.target.value }))} required>
          <option value="" disabled>Choose an instructor</option>
          {instructors.map((instructor) => <option key={instructor.id} value={instructor.id}>{instructor.full_name ?? "Unnamed instructor"}</option>)}
        </select></div>
        <div className="field"><label className="field-label" htmlFor="class-date">Date</label><input className="field-input" id="class-date" type="date" value={values.classDate} onChange={(event) => setValues((current) => ({ ...current, classDate: event.target.value }))} required /></div>
        <div className="field"><label className="field-label" htmlFor="class-time">Start time</label><input className="field-input" id="class-time" type="time" value={values.startTime} onChange={(event) => setValues((current) => ({ ...current, startTime: event.target.value }))} required /></div>
        <div className="field"><label className="field-label" htmlFor="class-duration">Duration (min)</label><input className="field-input" id="class-duration" type="number" min={1} value={values.durationMinutes} onChange={(event) => setValues((current) => ({ ...current, durationMinutes: event.target.value }))} required /></div>
        <div className="field"><label className="field-label" htmlFor="class-capacity">Capacity</label><input className="field-input" id="class-capacity" type="number" min={1} value={values.capacity} onChange={(event) => setValues((current) => ({ ...current, capacity: event.target.value }))} required /></div>
      </div>
      {error ? <p className="field-error" aria-live="polite">{error}</p> : null}
      <div className="staff-class-form-actions">
        <button className="btn btn-outline btn-sm" type="button" onClick={onCancel} disabled={isSubmitting}>Cancel</button>
        <button className="btn btn-primary btn-sm" type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving…" : submitLabel}</button>
      </div>
    </form>
  );
}

export function LiveRegister({ classes, instructors, currentClassId, nextClassId, today, promoLabelByClassId }: { classes: RegisterClass[]; instructors: InstructorOption[]; currentClassId: string | null; nextClassId: string | null; today: string; promoLabelByClassId: Record<string, string> }) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function submitCreate(values: FormValues) {
    const response = await fetch("/api/staff/classes/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toPayload(values, instructors)),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    if (!response.ok) throw new Error(payload.error?.message ?? "Unable to create this class.");
    setIsCreating(false);
    router.refresh();
  }

  async function submitEdit(classId: string, values: FormValues) {
    const response = await fetch(`/api/staff/classes/${classId}/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toPayload(values, instructors)),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    if (!response.ok) throw new Error(payload.error?.message ?? "Unable to update this class.");
    setEditingId(null);
    router.refresh();
  }

  async function cancelClass(classId: string) {
    if (!window.confirm("Cancel this class? This cannot be undone.")) return;
    setPendingId(classId);
    setError("");
    try {
      const response = await fetch(`/api/staff/classes/${classId}/delete`, { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Unable to cancel this class.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to cancel this class.");
    } finally {
      setPendingId(null);
    }
  }

  async function togglePromoted(classId: string, promoted: boolean) {
    setPendingId(classId);
    setError("");
    try {
      const response = await fetch(`/api/staff/classes/${classId}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promoted }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Unable to update this class.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update this class.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="surface-card staff-today-panel animate-fade-up" style={{ animationDelay: "60ms" }} aria-labelledby="today-studio-title">
      <div className="staff-panel-heading">
        <div><p className="eyebrow"><span /> Live register</p><h2 id="today-studio-title">Today at the studio</h2></div>
        {isCreating ? null : <button className="btn btn-primary btn-sm" type="button" onClick={() => setIsCreating(true)}>Create class</button>}
      </div>
      {error ? <p className="staff-search-error" aria-live="polite">{error}</p> : null}
      {isCreating ? <ClassForm instructors={instructors} initial={emptyForm(today)} submitLabel="Create class" onCancel={() => setIsCreating(false)} onSubmit={submitCreate} /> : null}
      {classes.length ? (
        <ul className="staff-class-list">
          {classes.map((classRow) => {
            const level = fillLevel(classRow.booked_count, classRow.capacity);
            const isPriority = classRow.id === currentClassId || classRow.id === nextClassId;
            const spots = classRow.capacity - classRow.booked_count;
            const statusText = spots <= 0 ? "Class full" : spots === 1 ? "Only 1 spot left" : `${spots} spots open`;
            const isEditing = editingId === classRow.id;
            const isPending = pendingId === classRow.id;
            const underbooked = isUnderbooked(classRow.booked_count, classRow.capacity);

            if (isEditing) {
              return (
                <li className="staff-class-form-row" key={classRow.id}>
                  <ClassForm
                    instructors={instructors}
                    initial={{ name: classRow.name, type: classRow.type, instructorMemberId: classRow.instructor_member_id ?? "", classDate: classRow.class_date, startTime: classRow.start_time.slice(0, 5), durationMinutes: String(classRow.duration_minutes), capacity: String(classRow.capacity) }}
                    submitLabel="Save changes"
                    onCancel={() => setEditingId(null)}
                    onSubmit={(values) => submitEdit(classRow.id, values)}
                  />
                </li>
              );
            }

            return (
              <li className={`staff-class-row staff-fill-${level}${isPriority ? " staff-class-priority" : ""}`} key={classRow.id}>
                <InstructorAvatar name={classRow.instructor} size={40} />
                <div className="staff-class-summary">
                  <strong>{classRow.name}{classRow.promoted ? <span className="badge badge-brand staff-class-promoted-badge">Promoted</span> : null}</strong>
                  <span>{formatTime(classRow.start_time)} · {classRow.instructor}</span>
                  {classRow.promoted && promoLabelByClassId[classRow.id] ? <small className="staff-class-promo-trace">{promoLabelByClassId[classRow.id]}</small> : null}
                </div>
                <div className="staff-fill-unit">
                  <div className="staff-fill-label"><span className="staff-fill-status">{statusText}</span><strong>{classRow.booked_count}/{classRow.capacity}</strong></div>
                  <span className="staff-fill-track" aria-label={`${classRow.booked_count} of ${classRow.capacity} spots booked`}><span style={{ width: `${Math.min(100, classRow.capacity ? (classRow.booked_count / classRow.capacity) * 100 : 0)}%` }} /></span>
                </div>
                <div className="staff-schedule-actions">
                  {underbooked ? <button className="btn btn-outline btn-sm" type="button" disabled={isPending} onClick={() => void togglePromoted(classRow.id, !classRow.promoted)}>{isPending ? "…" : classRow.promoted ? "Unpromote" : "Promote"}</button> : null}
                  <button className="btn btn-outline btn-sm" type="button" disabled={isPending} onClick={() => setEditingId(classRow.id)}>Edit</button>
                  <button className="btn btn-outline-danger btn-sm" type="button" disabled={isPending} onClick={() => void cancelClass(classRow.id)}>{isPending ? "…" : "Cancel"}</button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="empty-state"><h3>No classes scheduled today</h3><p>There are no capacity or instructor details to monitor yet.</p></div>
      )}
    </section>
  );
}

function toPayload(values: FormValues, instructors: InstructorOption[]) {
  const instructor = instructors.find((option) => option.id === values.instructorMemberId);
  return {
    name: values.name,
    type: values.type,
    instructorMemberId: values.instructorMemberId,
    instructorName: instructor?.full_name ?? "",
    classDate: values.classDate,
    startTime: values.startTime,
    durationMinutes: Number(values.durationMinutes),
    capacity: Number(values.capacity),
  };
}
