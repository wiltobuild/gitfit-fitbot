"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function RequestTimeOff() {
  const router = useRouter();
  const [requestedDate, setRequestedDate] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requestedDate || isSubmitting) return;
    setIsSubmitting(true);
    setError("");
    setConfirmation("");
    try {
      const response = await fetch("/api/staff/time-off/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestedDate, reason: reason.trim() || null }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Unable to submit this request.");
      setConfirmation("Request submitted and pending review.");
      setRequestedDate("");
      setReason("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to submit this request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="surface-card staff-my-requests" aria-labelledby="request-time-off-title">
      <div className="staff-panel-heading">
        <div>
          <p className="eyebrow"><span /> Time off</p>
          <h2 id="request-time-off-title">Request time off</h2>
        </div>
      </div>
      <form className="staff-request-form" onSubmit={handleSubmit}>
        <div className="field">
          <label className="field-label" htmlFor="time-off-date">Date</label>
          <input className="field-input" id="time-off-date" type="date" value={requestedDate} onChange={(event) => setRequestedDate(event.target.value)} required />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="time-off-reason">Reason (optional)</label>
          <input className="field-input" id="time-off-reason" type="text" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. family trip" />
        </div>
        {error ? <p className="field-error" aria-live="polite">{error}</p> : null}
        {confirmation ? <p className="field-hint" aria-live="polite">{confirmation}</p> : null}
        <button className="btn btn-primary" type="submit" disabled={!requestedDate || isSubmitting}>{isSubmitting ? "Submitting…" : "Submit request"}</button>
      </form>
      <p className="staff-fitbot-text-hint">You can also ask FitBot to submit this for you.</p>
    </section>
  );
}
