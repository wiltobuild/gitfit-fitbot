import { describe, expect, it } from "vitest";

import { mergeActivityItems } from "@/app/staff/activity-log";

/**
 * Requirement (Step 7): the manager Activity Log surfaces canceled classes
 * alongside resolved time-off requests. The one piece of non-trivial, pure
 * logic a reasonable implementation factors out is the MERGE: take the N
 * time-off decision entries and M class-cancellation entries, tag each by kind,
 * and produce ONE list sorted newest-first by each item's own timestamp.
 *
 * Contract asserted here (informs the builder):
 *   mergeActivityItems(timeOffEntries, cancellationEntries) -> ActivityItem[]
 *     - returns exactly timeOffEntries.length + cancellationEntries.length items
 *       (nothing dropped, nothing duplicated),
 *     - every item is tagged with a discriminant `kind`: "time_off" for a
 *       time-off decision, "class_cancellation" for a canceled class,
 *     - each item preserves an `id` (unique key for React) and carries a
 *       sortable ISO `timestamp` — reviewed_at for a time-off decision,
 *       created_at for a cancellation,
 *     - the returned list is sorted strictly newest-first by that timestamp,
 *       INTERLEAVING the two kinds by time (not grouped kind-then-kind),
 *     - a time-off item still carries its display fields
 *       (requester_name, reviewer_name, status, requested_date),
 *     - a cancellation item still carries its display fields
 *       (class_label, canceler_name, booked_count).
 *
 * These are shape/behaviour assertions on a pure function only; the exact
 * property names for the display fields are what the builder should implement
 * to match the JSX it renders. Field names below mirror the existing
 * ActivityEntry (time-off) shape and the class_cancellations columns
 * (class_name/class_date/start_time -> class_label, canceled_by -> canceler_name,
 * booked_count) so they use real domain vocabulary.
 */

type TimeOffEntry = {
  id: string;
  requester_name: string;
  reviewer_name: string;
  status: "approved" | "denied";
  requested_date: string;
  reviewed_at: string;
};

type CancellationEntry = {
  id: string;
  class_label: string;
  canceler_name: string;
  booked_count: number;
  created_at: string;
};

const timeOff: TimeOffEntry[] = [
  {
    id: "to_1",
    requester_name: "Ann",
    reviewer_name: "Mona",
    status: "approved",
    requested_date: "2026-09-05",
    reviewed_at: "2026-08-20T09:00:00.000Z"
  },
  {
    id: "to_2",
    requester_name: "Ben",
    reviewer_name: "Mona",
    status: "denied",
    requested_date: "2026-09-06",
    reviewed_at: "2026-08-22T15:00:00.000Z"
  }
];

const cancellations: CancellationEntry[] = [
  {
    id: "cx_1",
    class_label: "Sunrise Flow — Sep 1, 7:00 AM",
    canceler_name: "Mona",
    booked_count: 4,
    created_at: "2026-08-21T12:00:00.000Z"
  }
];

describe("mergeActivityItems — merge + tag + sort newest-first", () => {
  it("returns every entry from both sources, nothing dropped or duplicated", () => {
    const merged = mergeActivityItems(timeOff, cancellations);
    expect(merged).toHaveLength(timeOff.length + cancellations.length);
    const ids = merged.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(["to_1", "to_2", "cx_1"]));
  });

  it("tags each item with a discriminant kind", () => {
    const merged = mergeActivityItems(timeOff, cancellations);
    const byId = new Map(merged.map((item) => [item.id, item]));
    expect(byId.get("to_1")?.kind).toBe("time_off");
    expect(byId.get("to_2")?.kind).toBe("time_off");
    expect(byId.get("cx_1")?.kind).toBe("class_cancellation");
  });

  it("sorts strictly newest-first by timestamp, interleaving the two kinds", () => {
    const merged = mergeActivityItems(timeOff, cancellations);
    // Expected order by timestamp desc:
    //   to_2 (08-22) > cx_1 (08-21) > to_1 (08-20)
    expect(merged.map((item) => item.id)).toEqual(["to_2", "cx_1", "to_1"]);

    const timestamps = merged.map((item) => new Date(item.timestamp).getTime());
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i - 1]).toBeGreaterThanOrEqual(timestamps[i]);
    }
  });

  it("preserves display fields for each kind", () => {
    const merged = mergeActivityItems(timeOff, cancellations);
    const byId = new Map(merged.map((item) => [item.id, item]));

    const to = byId.get("to_1") as Record<string, unknown>;
    expect(to.requester_name).toBe("Ann");
    expect(to.reviewer_name).toBe("Mona");
    expect(to.status).toBe("approved");
    expect(to.requested_date).toBe("2026-09-05");

    const cx = byId.get("cx_1") as Record<string, unknown>;
    expect(cx.class_label).toBe("Sunrise Flow — Sep 1, 7:00 AM");
    expect(cx.canceler_name).toBe("Mona");
    expect(cx.booked_count).toBe(4);
  });

  it("handles an empty cancellation list (existing time-off behaviour unchanged)", () => {
    const merged = mergeActivityItems(timeOff, []);
    expect(merged).toHaveLength(2);
    expect(merged.every((item) => item.kind === "time_off")).toBe(true);
    expect(merged.map((item) => item.id)).toEqual(["to_2", "to_1"]);
  });
});
