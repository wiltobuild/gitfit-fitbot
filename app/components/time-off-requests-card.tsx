"use client";

import { useState } from "react";

import { InstructorAvatar } from "@/app/components/instructor-avatar";
import type { RichCard } from "@/lib/chatbot/types";

export function TimeOffRequestsCard({ formatDate, requests: initialRequests }: { formatDate: (date: string) => string; requests: Extract<RichCard, { kind: "time-off" }>["requests"] }) {
  const [requests, setRequests] = useState(initialRequests); const [pendingId, setPendingId] = useState<string | null>(null); const [error, setError] = useState(""); const [errorId, setErrorId] = useState<string | null>(null);
  async function resolve(id: string, decision: "approved" | "denied") {
    setPendingId(id); setError(""); setErrorId(null);
    try { const response = await fetch("/api/staff/time-off/resolve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: id, decision }) }); const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } }; if (!response.ok) throw new Error(payload.error?.message ?? "Unable to update this request."); setRequests((current) => current.filter((request) => request.id !== id)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update this request."); setErrorId(id); }
    finally { setPendingId(null); }
  }
  return <section className="chat-card chat-members-card chat-time-off-card" aria-label="Time-off requests"><h2 className="sr-only">Time-off requests</h2>{requests.length === 0 ? <p className="chat-time-off-empty">No pending time-off requests</p> : requests.map((request) => { const isPending = pendingId === request.id; const name = request.name ?? "Staff member"; return <div className="chat-member-row" key={request.id ?? request.date}><InstructorAvatar name={name} size={40} /><div><strong>{name}</strong><span>{formatDate(request.date)}</span>{request.reason ? <small>{request.reason}</small> : null}{errorId === request.id ? <small className="staff-search-error" aria-live="polite">{error}</small> : null}</div>{request.id ? <button className="btn btn-success btn-sm" disabled={isPending} onClick={() => void resolve(request.id, "approved")} type="button">{isPending ? "Approving..." : "Approve"}</button> : null}</div>; })}</section>;
}
