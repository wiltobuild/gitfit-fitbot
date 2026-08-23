"use client";

import { useState } from "react";

export type PendingClassChangeRequest = {
  id: string;
  requester_name: string;
  class_label: string;
  type: "swap" | "cancel";
  reason: string | null;
};

export function ClassChangeInbox({ initialRequests }: { initialRequests: PendingClassChangeRequest[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function resolve(id: string, decision: "approved" | "denied") {
    setPendingId(id);
    setError("");
    try {
      const response = await fetch("/api/staff/class-changes/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: id, decision }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Unable to update this request.");
      setRequests((current) => current.filter((request) => request.id !== id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update this request.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className={`surface-card staff-requests-inbox${requests.length ? " staff-panel-flagged staff-panel-flagged-warning" : ""}`} aria-labelledby="class-change-inbox-title">
      <div className="staff-panel-heading">
        <div>
          <p className="eyebrow"><span /> Schedule changes</p>
          <h2 id="class-change-inbox-title">Swap &amp; cancel requests</h2>
        </div>
        <p>{requests.length ? `${requests.length} pending` : "All caught up"}</p>
      </div>
      {error ? <p className="staff-search-error" aria-live="polite">{error}</p> : null}
      {requests.length === 0 ? (
        <div className="empty-state"><h3>No pending requests</h3><p>Swap and cancel requests from trainers will show up here.</p></div>
      ) : (
        <ul className="staff-request-list" aria-label="Pending schedule-change requests">
          {requests.map((request) => {
            const isPending = pendingId === request.id;
            return (
              <li className="staff-request-row" key={request.id}>
                <div className="staff-request-summary">
                  <strong>{request.requester_name}</strong>
                  <span>{request.type === "swap" ? "Swap" : "Cancel"} — {request.class_label}</span>
                  {request.reason ? <small>&ldquo;{request.reason}&rdquo;</small> : null}
                </div>
                <div className="staff-request-actions">
                  <button className="btn btn-outline-danger btn-sm" disabled={isPending} onClick={() => void resolve(request.id, "denied")} type="button">
                    {isPending ? "…" : "Deny"}
                  </button>
                  <button className="btn btn-success btn-sm" disabled={isPending} onClick={() => void resolve(request.id, "approved")} type="button">
                    {isPending ? "…" : "Approve"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
