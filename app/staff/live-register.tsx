"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ScheduleRow } from "@/app/components/schedule-row";
import { ClassForm, classFormToPayload, emptyClassForm, type ClassFormValues, type InstructorOption } from "@/app/components/class-form";

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

function formatTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
}
// "Underbooked" per the shared suite vocabulary: booked ÷ capacity < 45%.
function isUnderbooked(booked: number, capacity: number) {
  return capacity > 0 && booked / capacity < 0.45;
}

export function LiveRegister({ classes, instructors, currentClassId, nextClassId, today, promoLabelByClassId }: { classes: RegisterClass[]; instructors: InstructorOption[]; currentClassId: string | null; nextClassId: string | null; today: string; promoLabelByClassId: Record<string, string> }) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function submitCreate(values: ClassFormValues) {
    const response = await fetch("/api/staff/classes/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(classFormToPayload(values, instructors)),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    if (!response.ok) throw new Error(payload.error?.message ?? "Unable to create this class.");
    setIsCreating(false);
    router.refresh();
  }

  async function submitEdit(classId: string, values: ClassFormValues) {
    const response = await fetch(`/api/staff/classes/${classId}/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(classFormToPayload(values, instructors)),
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
      {isCreating ? <ClassForm instructors={instructors} initial={emptyClassForm(today)} submitLabel="Create class" onCancel={() => setIsCreating(false)} onSubmit={submitCreate} /> : null}
      {classes.length ? (
        <ul className="staff-class-list">
          {classes.map((classRow) => {
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
              <ScheduleRow
                key={classRow.id}
                instructor={classRow.instructor}
                highlighted={isPriority}
                name={<>{classRow.name}{classRow.promoted ? <span className="badge badge-brand staff-class-promoted-badge">Promoted</span> : null}</>}
                meta={<>
                  <span>{formatTime(classRow.start_time)} · {classRow.instructor}</span>
                  {classRow.promoted && promoLabelByClassId[classRow.id] ? <small className="staff-class-promo-trace">{promoLabelByClassId[classRow.id]}</small> : null}
                </>}
                capacity={{ booked: classRow.booked_count, capacity: classRow.capacity }}
                capacityLabel={<><span className="staff-fill-status">{statusText}</span><strong>{classRow.booked_count}/{classRow.capacity}</strong></>}
                actions={<>
                  {underbooked ? <button className="btn btn-outline btn-sm" type="button" disabled={isPending} onClick={() => void togglePromoted(classRow.id, !classRow.promoted)}>{isPending ? "…" : classRow.promoted ? "Unpromote" : "Promote"}</button> : null}
                  <button className="btn btn-outline btn-sm" type="button" disabled={isPending} onClick={() => setEditingId(classRow.id)}>Edit</button>
                  <button className="btn btn-outline-danger btn-sm" type="button" disabled={isPending} onClick={() => void cancelClass(classRow.id)}>{isPending ? "…" : "Cancel"}</button>
                </>}
              />
            );
          })}
        </ul>
      ) : (
        <div className="empty-state"><h3>No classes scheduled today</h3><p>There are no capacity or instructor details to monitor yet.</p></div>
      )}
    </section>
  );
}
