"use client";

import { FormEvent, useState } from "react";

import type { InstructorOption } from "@/lib/members/queries";

export type { InstructorOption };

export type ClassFormValues = { name: string; type: string; instructorMemberId: string; classDate: string; startTime: string; durationMinutes: string; capacity: string };

export const emptyClassForm = (defaultDate: string): ClassFormValues => ({ name: "", type: "", instructorMemberId: "", classDate: defaultDate, startTime: "", durationMinutes: "45", capacity: "16" });

export function classFormToPayload(values: ClassFormValues, instructors: InstructorOption[]) {
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

// Shared by the /staff Live register class-management UI and the admin-only
// edit controls on the member-facing booking page (/appointments) -- same
// fields, same validation, same submit contract either way.
export function ClassForm({ instructors, initial, submitLabel, onCancel, onSubmit }: { instructors: InstructorOption[]; initial: ClassFormValues; submitLabel: string; onCancel: () => void; onSubmit: (values: ClassFormValues) => Promise<void> }) {
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
