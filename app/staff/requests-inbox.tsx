"use client";

import { useState } from "react";

export type PendingRequest = {
  id: string;
  requester_name: string;
  requested_date: string;
  reason: string | null;
};

function formatRequestedDate(date: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date(`${date}T12:00:00`));
}

export function RequestsInbox({ initialRequests }: { initialRequests: PendingRequest[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // initialRequests only seeds state on mount -- without this, a realtime
  // refresh that brings a newly-submitted request never reaches this list,
  // since React ignores prop changes for values already used as useState's
  // initial argument. Adjusting state during render (not in an effect) is
  // the pattern React recommends for this exact case.
  const [prevInitialRequests, setPrevInitialRequests] = useState(initialRequests);
  if (initialRequests !== prevInitialRequests) {
    setPrevInitialRequests(initialRequests);
    setRequests(initialRequests);
  }

  async function resolve(id: string, decision: "approved" | "denied") {
    setPendingId(id);
    setError("");
    try {
      const response = await fetch("/api/staff/time-off/resolve", {
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
    <section className={`surface-card staff-requests-inbox${requests.length ? " staff-panel-flagged staff-panel-flagged-warning" : ""}`} aria-labelledby="requests-inbox-title">
      <div className="staff-panel-heading">
        <div>
          <p className="eyebrow"><span /> Requests</p>
          <h2 id="requests-inbox-title">Requests inbox</h2>
        </div>
        <p>{requests.length ? `${requests.length} pending` : "All caught up"}</p>
      </div>
      {error ? <p className="staff-search-error" aria-live="polite">{error}</p> : null}
      {requests.length === 0 ? (
        <div className="empty-state"><h3>No pending requests</h3><p>Time-off requests will show up here as trainers submit them.</p></div>
      ) : (
        <ul className="staff-request-list" aria-label="Pending time-off requests">
          {requests.map((request) => {
            const isPending = pendingId === request.id;
            return (
              <li className="staff-request-row" key={request.id}>
                <div className="staff-request-summary">
                  <strong>{request.requester_name}</strong>
                  <span>Requesting {formatRequestedDate(request.requested_date)}</span>
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
