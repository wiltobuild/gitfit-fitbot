import { describe, expect, it } from "vitest";

import { deleteClass } from "@/lib/classes/queries";

/**
 * Requirement (Step 6): the class-delete flow must orchestrate cancellation in
 * a strict order — log the audit row, then deny pending change requests, THEN
 * hard-delete the class — so that the roster/pending rows are captured before
 * the delete cascades them away, and an audit-log failure never lets the delete
 * through.
 *
 * Contract asserted here (informs the builder):
 *   deleteClass(supabase, { classId, canceledBy })   // orchestration function
 *     1. calls logClassCancellation(supabase, { classId, canceledBy })
 *          -> inserts one row into "class_cancellations"
 *     2. calls denyPendingRequestsForCanceledClass(supabase, { classId, reviewerId: canceledBy })
 *          -> issues one update against "class_change_requests"
 *     3. THEN issues .from("classes").delete().eq("id", classId)
 *   - if step 1 throws, the "classes" delete is NEVER issued and the error
 *     propagates.
 *   - on success, the "classes" delete is issued exactly once, after both prior
 *     calls have completed.
 *
 * Rather than module-mocking the two helpers, we inject a single recording stub
 * Supabase client and observe the ORDER of the real DB operations each helper
 * performs. This keeps consistency with the DI/hand-rolled-stub house style
 * (see log-class-cancellation.test.ts / deny-pending-requests-on-cancel.test.ts)
 * and proves the true end-to-end sequence, not a mocked approximation.
 *
 * The stub records a flat, ordered log of the terminal operations that matter
 * for sequencing:
 *   - "class_cancellations.insert"   (logClassCancellation)
 *   - "class_change_requests.update" (denyPendingRequestsForCanceledClass)
 *   - "classes.delete"               (the hard delete)
 * Read operations (classes.select, bookings, members/profiles) are served but
 * not asserted on — their internals are covered by steps 4/5's own tests.
 */

type Member = { auth_user_id: string; full_name: string | null; email: string | null };

type StubOptions = {
  classRow: { name: string; class_date: string; start_time: string };
  bookingUserIds: string[];
  members: Member[];
  deniedRows: Array<{ id: string }>;
  // If set, logClassCancellation's audit insert rejects with this error,
  // simulating a failed audit-log write.
  failInsert?: boolean;
};

function makeStubClient(opts: StubOptions) {
  const { classRow, bookingUserIds, members, deniedRows, failInsert } = opts;
  const opsLog: string[] = [];

  const client = {
    from(table: string) {
      if (table === "classes") {
        return {
          select(_cols: string) {
            return {
              eq(_col: string, _val: unknown) {
                const result = { data: classRow, error: null };
                return {
                  maybeSingle: async () => result,
                  single: async () => result
                };
              }
            };
          },
          delete() {
            return {
              eq(_col: string, _val: unknown) {
                opsLog.push("classes.delete");
                return Promise.resolve({ error: null });
              }
            };
          }
        };
      }

      if (table === "bookings") {
        return {
          select(_cols: string) {
            return {
              eq(_col: string, _val: unknown) {
                return Promise.resolve({
                  data: bookingUserIds.map((user_id) => ({ user_id })),
                  error: null
                });
              }
            };
          }
        };
      }

      if (table === "members") {
        return {
          select(_cols: string) {
            return {
              in(_col: string, _vals: unknown) {
                return Promise.resolve({ data: members, error: null });
              }
            };
          }
        };
      }

      if (table === "profiles") {
        return {
          select(_cols: string) {
            return {
              in(_col: string, _vals: unknown) {
                return Promise.resolve({ data: [], error: null });
              }
            };
          }
        };
      }

      if (table === "class_cancellations") {
        return {
          insert(_payload: Record<string, unknown>) {
            opsLog.push("class_cancellations.insert");
            if (failInsert) {
              return Promise.resolve({ error: new Error("audit insert failed") });
            }
            return Promise.resolve({ error: null });
          }
        };
      }

      if (table === "class_change_requests") {
        return {
          update(_patch: Record<string, unknown>) {
            const chain = {
              eq(_col: string, _val: unknown) {
                return chain;
              },
              select(_cols: string) {
                opsLog.push("class_change_requests.update");
                return Promise.resolve({ data: deniedRows, error: null });
              }
            };
            return chain;
          }
        };
      }

      throw new Error(`unexpected table in stub: ${table}`);
    }
  };

  return { client, opsLog };
}

const classRow = { name: "Sunrise Flow", class_date: "2026-09-01", start_time: "07:00" };

describe("deleteClass — cancellation flow order (log -> deny -> delete)", () => {
  it("logs, then denies pending requests, then deletes — in that exact order, delete last", async () => {
    const { client, opsLog } = makeStubClient({
      classRow,
      bookingUserIds: ["user_a", "user_b"],
      members: [
        { auth_user_id: "user_a", full_name: "Ann", email: "ann@example.com" },
        { auth_user_id: "user_b", full_name: "Ben", email: "ben@example.com" }
      ],
      deniedRows: [{ id: "req_1" }]
    });

    await deleteClass(client as never, { classId: "class_abc", canceledBy: "admin_1" });

    // The audit insert and the deny-update must both happen before the delete.
    const insertIdx = opsLog.indexOf("class_cancellations.insert");
    const denyIdx = opsLog.indexOf("class_change_requests.update");
    const deleteIdx = opsLog.indexOf("classes.delete");

    expect(insertIdx).toBeGreaterThanOrEqual(0);
    expect(denyIdx).toBeGreaterThanOrEqual(0);
    expect(deleteIdx).toBeGreaterThanOrEqual(0);

    // Strict ordering: log -> deny -> delete.
    expect(insertIdx).toBeLessThan(denyIdx);
    expect(denyIdx).toBeLessThan(deleteIdx);

    // Delete is the final terminal write.
    expect(opsLog[opsLog.length - 1]).toBe("classes.delete");
  });

  it("issues the classes delete exactly once on the success path", async () => {
    const { client, opsLog } = makeStubClient({
      classRow,
      bookingUserIds: [],
      members: [],
      deniedRows: []
    });

    await deleteClass(client as never, { classId: "class_abc", canceledBy: "admin_1" });

    const deleteCount = opsLog.filter((op) => op === "classes.delete").length;
    expect(deleteCount).toBe(1);
  });

  it("never issues the classes delete, and propagates, when the audit-log write fails", async () => {
    const { client, opsLog } = makeStubClient({
      classRow,
      bookingUserIds: ["user_a"],
      members: [{ auth_user_id: "user_a", full_name: "Ann", email: "ann@example.com" }],
      deniedRows: [],
      failInsert: true
    });

    await expect(
      deleteClass(client as never, { classId: "class_abc", canceledBy: "admin_1" })
    ).rejects.toThrow();

    expect(opsLog).not.toContain("classes.delete");
  });
});
