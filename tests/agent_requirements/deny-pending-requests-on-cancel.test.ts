import { describe, expect, it } from "vitest";

import { denyPendingRequestsForCanceledClass } from "@/lib/class-changes/queries";

/**
 * Requirement (Step 5): auto-resolve every still-`pending`
 * class_change_requests row for a class that is about to be deleted, denying
 * them with a cancellation note.
 *
 * Contract asserted here (informs the builder):
 *   denyPendingRequestsForCanceledClass(supabase, { classId, reviewerId })
 *     - issues ONE update against "class_change_requests" that filters on BOTH
 *         .eq("class_id", classId) AND .eq("status", "pending")
 *       so rows already approved/denied for that class are excluded by the
 *       filter (not merely skipped after the fact).
 *     - the update patch sets status='denied', reviewed_by=reviewerId,
 *       reviewed_at to some timestamp, and overwrites `reason` with a note that
 *       mentions the class was canceled (exact wording is the builder's call).
 *     - reports the number of rows denied (the resolved value must expose a
 *       count; here we accept either a raw number or an object carrying a
 *       numeric `count`/`denied`/`deniedCount`).
 *     - zero pending rows -> reports 0, no throw.
 *
 * The stub client below matches the guarded-update house pattern this repo
 * already uses (see resolveClassChangeRequest in this same file):
 *   .from("class_change_requests").update(patch).eq(col, val).eq(col, val).select("id")
 * resolving to { data, error } where `data` is the set of updated rows.
 */

type UpdateCall = {
  table: string;
  patch: Record<string, unknown>;
  eqFilters: Array<{ column: string; value: unknown }>;
};

type StubOptions = {
  // The rows the DB "would" return after applying the status-guarded update,
  // i.e. only the currently-pending rows for the target class.
  deniedRows: Array<{ id: string }>;
};

function makeStubClient({ deniedRows }: StubOptions) {
  const updateCalls: UpdateCall[] = [];

  const client = {
    from(table: string) {
      return {
        update(patch: Record<string, unknown>) {
          const call: UpdateCall = { table, patch, eqFilters: [] };
          updateCalls.push(call);

          const chain = {
            eq(column: string, value: unknown) {
              call.eqFilters.push({ column, value });
              return chain;
            },
            select(_cols: string) {
              return Promise.resolve({ data: deniedRows, error: null });
            }
          };
          return chain;
        }
      };
    }
  };

  return { client, updateCalls };
}

function reportedCount(result: unknown): number {
  if (typeof result === "number") return result;
  if (result && typeof result === "object") {
    const obj = result as Record<string, unknown>;
    for (const key of ["count", "denied", "deniedCount"]) {
      if (typeof obj[key] === "number") return obj[key] as number;
    }
  }
  throw new Error(`could not read a numeric count from result: ${JSON.stringify(result)}`);
}

describe("denyPendingRequestsForCanceledClass — status-guarded bulk deny on class cancel", () => {
  it("denies only the pending rows (filtering on class_id AND status='pending') and reports the count", async () => {
    // 2 pending rows for the target class; a 3rd already-denied row for the
    // same class must be excluded purely by the status filter, so the DB-side
    // update only ever touches these two.
    const { client, updateCalls } = makeStubClient({
      deniedRows: [{ id: "req_pending_1" }, { id: "req_pending_2" }]
    });

    const result = await denyPendingRequestsForCanceledClass(client as never, {
      classId: "class_abc",
      reviewerId: "admin_1"
    });

    expect(reportedCount(result)).toBe(2);

    expect(updateCalls).toHaveLength(1);
    const call = updateCalls[0];
    expect(call.table).toBe("class_change_requests");

    // Filter must target class_id AND status='pending'.
    expect(call.eqFilters).toEqual(
      expect.arrayContaining([
        { column: "class_id", value: "class_abc" },
        { column: "status", value: "pending" }
      ])
    );

    // Patch sets the denial + reviewer + a cancellation reason.
    expect(call.patch.status).toBe("denied");
    expect(call.patch.reviewed_by).toBe("admin_1");
    expect(call.patch.reviewed_at).toBeTruthy();

    const reason = call.patch.reason;
    expect(typeof reason).toBe("string");
    expect((reason as string).toLowerCase()).toContain("cancel");
  });

  it("reports 0 and does not throw when there are no pending rows for the class", async () => {
    const { client } = makeStubClient({ deniedRows: [] });

    const result = await denyPendingRequestsForCanceledClass(client as never, {
      classId: "class_empty",
      reviewerId: "admin_1"
    });

    expect(reportedCount(result)).toBe(0);
  });
});
