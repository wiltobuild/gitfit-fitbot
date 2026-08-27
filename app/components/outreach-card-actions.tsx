"use client";

import { useState } from "react";

export function OutreachCardActions({ id, sent, sentAt }: { id: string; sent: boolean; sentAt?: string }) {
  const [sentLocally, setSentLocally] = useState(false); const [sentAtLocally, setSentAtLocally] = useState<string | undefined>(); const [pendingId, setPendingId] = useState<string | null>(null); const [error, setError] = useState(""); const [errorId, setErrorId] = useState<string | null>(null);
  const isSent = sent || sentLocally;
  const resolvedSentAt = sentAtLocally ?? sentAt;
  const sentLabel = resolvedSentAt ? `Sent ${new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(resolvedSentAt))}` : "Sent";

  async function sendOutreach() {
    setPendingId(id); setError(""); setErrorId(null);
    try { const response = await fetch("/api/staff/outreach/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draftId: id }) }); const payload = (await response.json().catch(() => ({}))) as { sentAt?: string; error?: { message?: string } }; if (!response.ok) throw new Error(payload.error?.message ?? "Unable to send this outreach draft."); setSentLocally(true); setSentAtLocally(payload.sentAt); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to send this outreach draft."); setErrorId(id); }
    finally { setPendingId(null); }
  }

  if (isSent) {
    return <div className="chat-outreach-actions"><span className="badge badge-success">{sentLabel}</span></div>;
  }

  return <div className="chat-outreach-actions">
    <button className="btn btn-secondary btn-sm" disabled={pendingId === id} onClick={() => void sendOutreach()} type="button">{pendingId === id ? "Sending..." : "Send when ready"}</button>
    {errorId === id ? <small className="staff-search-error" aria-live="polite">{error}</small> : null}
  </div>;
}
