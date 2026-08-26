"use client";

import { useState } from "react";

export type PendingClassCreationRequest = {
  id: string;
  requester_name: string;
  name: string;
  type: string;
  class_label: string;
  capacity: number;
  reason: string | null;
};

export function ClassCreationInbox({ initialRequests }: { initialRequests: PendingClassCreationRequest[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // See requests-inbox.tsx for why this is needed: useState's initial value
  // only applies on mount, so a realtime-driven prop update would otherwise
  // never reach this list.
  const [prevInitialRequests, setPrevInitialRequests] = useState(initialRequests);
  if (initialRequests !== prevInitialRequests) {
    setPrevInitialRequests(initialRequests);
    setRequests(initialRequests);
  }

  async function resolve(id: string, decision: "approved" | "denied") {
    setPendingId(id);
    setError("");
    try {
      const response = await fetch("/api/staff/class-creation-requests/resolve", {
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
    <section className={`surface-card staff-requests-inbox${requests.length ? " staff-panel-flagged staff-panel-flagged-warning" : ""}`} aria-labelledby="class-creation-inbox-title">
      <div className="staff-panel-heading">
        <div>
          <p className="eyebrow"><span /> Class proposals</p>
          <h2 id="class-creation-inbox-title">New class proposals</h2>
        </div>
        <p>{requests.length ? `${requests.length} pending` : "All caught up"}</p>
      </div>
      {error ? <p className="staff-search-error" aria-live="polite">{error}</p> : null}
      {requests.length === 0 ? (
        <div className="empty-state"><h3>No pending proposals</h3><p>Classes trainers propose will show up here for approval.</p></div>
      ) : (
        <ul className="staff-request-list" aria-label="Pending class proposals">
          {requests.map((request) => {
            const isPending = pendingId === request.id;
            return (
              <li className="staff-request-row" key={request.id}>
                <div className="staff-request-summary">
                  <strong>{request.requester_name}</strong>
                  <span>{request.name} ({request.type}) — {request.class_label} · capacity {request.capacity}</span>
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
