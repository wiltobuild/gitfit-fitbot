import { describe, expect, it } from "vitest";

import { mergeRefreshedClasses } from "@/lib/appointments/merge-refreshed-classes";

/**
 * Requirement (Step 5): the Member appointments schedule must reflect live
 * capacity via a Realtime subscription that refetches GET /api/appointments/classes
 * and merges the fresh rows into `classes` state — WITHOUT letting a stale refetch
 * clobber a booking the current user just made locally.
 *
 * The Supabase subscription lifecycle itself needs a browser/live socket and is
 * out of scope for a pure unit test. The extractable pure seam is the merge:
 *
 *   mergeRefreshedClasses(
 *     current: ClassSession[],
 *     refreshed: ClassSession[],
 *     pendingId?: string | null,
 *   ): ClassSession[]
 *
 * Rules asserted (these are the contract for the builder):
 *   1. Live capacity wins: booked_count / capacity (and other server-owned
 *      display fields) come from `refreshed`, so a change made in another
 *      tab/device is reflected here.
 *   2. Optimistic protection: for the class whose id === pendingId, the CURRENT
 *      `isBookedByCurrentUser` is preserved even if `refreshed` still shows the
 *      old value — a background refetch that predates the user's own write must
 *      not silently undo their booking/cancellation.
 *   3. For every other class, `isBookedByCurrentUser` follows `refreshed` (so a
 *      booking made elsewhere by this user propagates in).
 *   4. Rows present only in `refreshed` are added; rows absent from `refreshed`
 *      are dropped — the list tracks the live schedule.
 *   5. Ordering follows `refreshed` (the server's canonical order).
 */

type ClassSession = {
  id: string;
  name: string;
  type: string;
  instructor: string;
  class_date: string;
  start_time: string;
  duration_minutes: number;
  capacity: number;
  booked_count: number;
  isBookedByCurrentUser: boolean;
};

function makeClass(overrides: Partial<ClassSession> & { id: string }): ClassSession {
  return {
    name: "Sunrise Flow",
    type: "yoga",
    instructor: "Sofia Martinez",
    class_date: "2026-08-25",
    start_time: "07:00",
    duration_minutes: 45,
    capacity: 12,
    booked_count: 4,
    isBookedByCurrentUser: false,
    ...overrides,
  };
}

describe("mergeRefreshedClasses — live-capacity merge with optimistic protection", () => {
  it("takes live capacity (booked_count/capacity) from the refreshed rows", () => {
    const current = [makeClass({ id: "a", booked_count: 4, capacity: 12 })];
    const refreshed = [makeClass({ id: "a", booked_count: 9, capacity: 12 })];

    const result = mergeRefreshedClasses(current, refreshed, null);
    const a = result.find((row) => row.id === "a");
    expect(a?.booked_count).toBe(9);
    expect(a?.capacity).toBe(12);
  });

  it("does NOT revert the pending class's own booking flag when the refetch is stale", () => {
    // User just reserved class "a" locally -> isBookedByCurrentUser true, booked_count 5.
    // pendingId is "a". The refetch response predates that write: still false/4.
    const current = [makeClass({ id: "a", isBookedByCurrentUser: true, booked_count: 5 })];
    const refreshed = [makeClass({ id: "a", isBookedByCurrentUser: false, booked_count: 4 })];

    const result = mergeRefreshedClasses(current, refreshed, "a");
    const a = result.find((row) => row.id === "a");
    // The user's own booking must survive.
    expect(a?.isBookedByCurrentUser).toBe(true);
    // Live capacity may still update from the refresh, but the user's booking is
    // not undone. At minimum, the flag must not have been reverted to false.
    expect(a?.isBookedByCurrentUser).not.toBe(false);
  });

  it("follows the refetch's booking flag for classes that are NOT pending", () => {
    // Another tab booked class "b" as this same user; nothing pending here.
    const current = [makeClass({ id: "b", isBookedByCurrentUser: false, booked_count: 4 })];
    const refreshed = [makeClass({ id: "b", isBookedByCurrentUser: true, booked_count: 5 })];

    const result = mergeRefreshedClasses(current, refreshed, null);
    const b = result.find((row) => row.id === "b");
    expect(b?.isBookedByCurrentUser).toBe(true);
    expect(b?.booked_count).toBe(5);
  });

  it("does not touch OTHER classes' flags while one class is pending", () => {
    const current = [
      makeClass({ id: "a", isBookedByCurrentUser: true, booked_count: 5 }),
      makeClass({ id: "b", isBookedByCurrentUser: false, booked_count: 4 }),
    ];
    const refreshed = [
      makeClass({ id: "a", isBookedByCurrentUser: false, booked_count: 4 }),
      makeClass({ id: "b", isBookedByCurrentUser: true, booked_count: 6 }),
    ];

    const result = mergeRefreshedClasses(current, refreshed, "a");
    expect(result.find((row) => row.id === "a")?.isBookedByCurrentUser).toBe(true);
    // b is not pending -> follows refresh.
    expect(result.find((row) => row.id === "b")?.isBookedByCurrentUser).toBe(true);
    expect(result.find((row) => row.id === "b")?.booked_count).toBe(6);
  });

  it("adds newly-appeared classes and drops ones no longer in the refresh", () => {
    const current = [makeClass({ id: "gone" }), makeClass({ id: "stays" })];
    const refreshed = [makeClass({ id: "stays" }), makeClass({ id: "new" })];

    const result = mergeRefreshedClasses(current, refreshed, null);
    const ids = result.map((row) => row.id);
    expect(ids).toContain("stays");
    expect(ids).toContain("new");
    expect(ids).not.toContain("gone");
  });

  it("preserves the refreshed ordering", () => {
    const current = [makeClass({ id: "x" }), makeClass({ id: "y" }), makeClass({ id: "z" })];
    const refreshed = [makeClass({ id: "z" }), makeClass({ id: "x" }), makeClass({ id: "y" })];

    const result = mergeRefreshedClasses(current, refreshed, null);
    expect(result.map((row) => row.id)).toEqual(["z", "x", "y"]);
  });
});
