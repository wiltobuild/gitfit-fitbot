"use client";

import { useState } from "react";
import Link from "next/link";

import type { StudioClass } from "@/lib/classes/queries";

type ApiError = { error?: { message?: string } };

const formatDate = (date: string) => new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date(`${date}T00:00:00`));
const formatTime = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
};

export function RecommendedClasses({ classes: initialClasses, reasonLabel }: { classes: StudioClass[]; reasonLabel: string | null }) {
  const [classes, setClasses] = useState(initialClasses);
  const [bookedIds, setBookedIds] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});

  async function book(classId: string) {
    setPendingId(classId);
    setErrorById((current) => { const next = { ...current }; delete next[classId]; return next; });
    try {
      const response = await fetch("/api/appointments/reserve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ classId }) });
      const payload = (await response.json()) as ApiError;
      if (!response.ok) throw new Error(payload.error?.message ?? "Unable to book this class.");
      setBookedIds((current) => new Set(current).add(classId));
      setClasses((current) => current.map((classRow) => classRow.id === classId ? { ...classRow, booked_count: classRow.booked_count + 1 } : classRow));
    } catch (caught) {
      setErrorById((current) => ({ ...current, [classId]: caught instanceof Error ? caught.message : "Unable to book this class." }));
    } finally {
      setPendingId(null);
    }
  }

  if (!classes.length) return null;

  return <section className="surface-card dashboard-card client-recommendations-card animate-fade-up" style={{ animationDelay: ".1s" }} aria-labelledby="recommended-classes-title">
    <div className="client-section-heading">
      <div><p className="eyebrow"><span /> Picked for you</p><h2 id="recommended-classes-title">Recommended classes</h2></div>
      <Link href="/appointments">Browse schedule</Link>
    </div>
    {reasonLabel ? <p className="client-recommendation-reason">{reasonLabel}</p> : null}
    <ul className="client-recommendation-list">
      {classes.map((classRow) => {
        const isBooked = bookedIds.has(classRow.id);
        const isFull = classRow.booked_count >= classRow.capacity && !isBooked;
        const isPending = pendingId === classRow.id;
        return <li key={classRow.id}>
          <div className="client-recommendation-summary">
            <strong>{classRow.name}</strong>
            <span>{classRow.instructor} · {formatDate(classRow.class_date)} · {formatTime(classRow.start_time)}</span>
            {errorById[classRow.id] ? <small className="card-error">{errorById[classRow.id]}</small> : null}
          </div>
          {isBooked
            ? <span className="badge badge-success booking-confirmed">Booked</span>
            : <button className="btn btn-primary btn-sm" disabled={isPending || isFull} onClick={() => void book(classRow.id)} type="button">
                {isPending ? "Booking..." : isFull ? "Full" : "Book"}
              </button>}
        </li>;
      })}
    </ul>
  </section>;
}
