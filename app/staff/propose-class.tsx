"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type FormValues = { name: string; type: string; classDate: string; startTime: string; durationMinutes: string; capacity: string; reason: string };
const emptyForm = (defaultDate: string): FormValues => ({ name: "", type: "", classDate: defaultDate, startTime: "", durationMinutes: "45", capacity: "16", reason: "" });

export function ProposeClass({ today }: { today: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [values, setValues] = useState(emptyForm(today));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setConfirmation("");
    try {
      const response = await fetch("/api/staff/class-creation-requests/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          type: values.type,
          classDate: values.classDate,
          startTime: values.startTime,
          durationMinutes: Number(values.durationMinutes),
          capacity: Number(values.capacity),
          reason: values.reason.trim() || null,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Unable to submit this proposal.");
      setConfirmation("Proposal submitted and pending manager approval.");
      setValues(emptyForm(today));
      setIsOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to submit this proposal.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="surface-card staff-my-requests" aria-labelledby="propose-class-title">
      <div className="staff-panel-heading">
        <div>
          <p className="eyebrow"><span /> Propose a class</p>
          <h2 id="propose-class-title">Suggest a new class</h2>
        </div>
        {isOpen ? null : <button className="btn btn-primary btn-sm" type="button" onClick={() => setIsOpen(true)}>New proposal</button>}
      </div>
      {confirmation ? <p className="field-hint" aria-live="polite">{confirmation}</p> : null}
      {isOpen ? (
        <form className="staff-class-form" onSubmit={handleSubmit}>
          <div className="staff-class-form-grid">
            <div className="field"><label className="field-label" htmlFor="proposal-name">Class name</label><input className="field-input" id="proposal-name" type="text" value={values.name} onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))} required /></div>
            <div className="field"><label className="field-label" htmlFor="proposal-type">Type</label><input className="field-input" id="proposal-type" type="text" list="proposal-type-options" value={values.type} onChange={(event) => setValues((current) => ({ ...current, type: event.target.value }))} required />
              <datalist id="proposal-type-options"><option value="Yoga" /><option value="Cycling" /><option value="HIIT" /><option value="Pilates" /><option value="Boxing" /><option value="Strength" /></datalist>
            </div>
            <div className="field"><label className="field-label" htmlFor="proposal-date">Date</label><input className="field-input" id="proposal-date" type="date" value={values.classDate} onChange={(event) => setValues((current) => ({ ...current, classDate: event.target.value }))} required /></div>
            <div className="field"><label className="field-label" htmlFor="proposal-time">Start time</label><input className="field-input" id="proposal-time" type="time" value={values.startTime} onChange={(event) => setValues((current) => ({ ...current, startTime: event.target.value }))} required /></div>
            <div className="field"><label className="field-label" htmlFor="proposal-duration">Duration (min)</label><input className="field-input" id="proposal-duration" type="number" min={1} value={values.durationMinutes} onChange={(event) => setValues((current) => ({ ...current, durationMinutes: event.target.value }))} required /></div>
            <div className="field"><label className="field-label" htmlFor="proposal-capacity">Capacity</label><input className="field-input" id="proposal-capacity" type="number" min={1} value={values.capacity} onChange={(event) => setValues((current) => ({ ...current, capacity: event.target.value }))} required /></div>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="proposal-reason">Notes for your manager (optional)</label>
            <input className="field-input" id="proposal-reason" type="text" value={values.reason} onChange={(event) => setValues((current) => ({ ...current, reason: event.target.value }))} placeholder="e.g. members have been asking for this" />
          </div>
          {error ? <p className="field-error" aria-live="polite">{error}</p> : null}
          <div className="staff-class-form-actions">
            <button className="btn btn-outline btn-sm" type="button" onClick={() => setIsOpen(false)} disabled={isSubmitting}>Cancel</button>
            <button className="btn btn-primary btn-sm" type="submit" disabled={isSubmitting}>{isSubmitting ? "Submitting…" : "Submit proposal"}</button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
