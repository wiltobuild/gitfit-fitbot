import { describe, expect, it } from "vitest";

import { updateClass } from "@/lib/classes/queries";

/**
 * Requirement (Step 1): Reject capacity edits below the class's current
 * booked_count in the server layer.
 *
 * Contract asserted here (informs the builder):
 *   updateClass(supabase, classId, input) resolves to a result object:
 *     - { ok: false, code: "capacity_below_booked", bookedCount }
 *         when input.capacity < the class's current booked_count.
 *         In this case NO `update` call is issued against "classes".
 *     - { ok: true } (a non-error, ok result) when input.capacity >= booked_count
 *         (including exactly equal). In this case the `update` IS issued.
 *
 * The function must accept an injectable Supabase-like client. Below is a
 * hand-rolled stub matching the chainable shape this repo already uses
 * (see lib/appointments/booking.ts): `.from(table).select(cols).eq(col,val).maybeSingle()`
 * for the read, and `.from(table).update(patch).eq(col,val)` for the write.
 */

type StubOptions = { bookedCount: number };

function makeStubClient({ bookedCount }: StubOptions) {
  const calls = {
    updateIssued: false,
    updatedTable: null as string | null,
    updatePatch: null as Record<string, unknown> | null
  };

  const client = {
    from(table: string) {
      return {
        // READ path: fetch the current booked_count for this class.
        select(_columns: string) {
          const readResult = { data: { booked_count: bookedCount }, error: null };
          const readChain = {
            eq(_column: string, _value: unknown) {
              return {
                ...readChain,
                // Support either maybeSingle() or single() for the read.
                maybeSingle: async () => readResult,
                single: async () => readResult
              };
            }
          };
          return readChain;
        },
        // WRITE path: the actual update. Records that it was issued.
        update(patch: Record<string, unknown>) {
          calls.updateIssued = true;
          calls.updatedTable = table;
          calls.updatePatch = patch;
          return {
            eq(_column: string, _value: unknown) {
              return Promise.resolve({ error: null });
            }
          };
        }
      };
    }
  };

  return { client, calls };
}

const baseInput = {
  name: "Sunrise Flow",
  type: "yoga",
  instructorMemberId: "member_1",
  instructorName: "Alex",
  classDate: "2026-09-01",
  startTime: "07:00",
  durationMinutes: 60,
  capacity: 20
};

describe("updateClass — reject capacity below current booked_count", () => {
  it("rejects with capacity_below_booked and issues no update when capacity (10) < booked_count (18)", async () => {
    const { client, calls } = makeStubClient({ bookedCount: 18 });

    const result = await updateClass(client as never, "class_abc", {
      ...baseInput,
      capacity: 10
    });

    expect(result).toMatchObject({ ok: false, code: "capacity_below_booked" });
    expect((result as { bookedCount?: number }).bookedCount).toBe(18);
    expect(calls.updateIssued).toBe(false);
  });

  it("allows the update when capacity (18) equals booked_count (18) and issues the update", async () => {
    const { client, calls } = makeStubClient({ bookedCount: 18 });

    const result = await updateClass(client as never, "class_abc", {
      ...baseInput,
      capacity: 18
    });

    expect(result).toMatchObject({ ok: true });
    expect(calls.updateIssued).toBe(true);
    expect(calls.updatedTable).toBe("classes");
    expect(calls.updatePatch).toMatchObject({ capacity: 18 });
  });

  it("allows the update when capacity (20) is above booked_count (18) and issues the update", async () => {
    const { client, calls } = makeStubClient({ bookedCount: 18 });

    const result = await updateClass(client as never, "class_abc", {
      ...baseInput,
      capacity: 20
    });

    expect(result).toMatchObject({ ok: true });
    expect(calls.updateIssued).toBe(true);
    expect(calls.updatedTable).toBe("classes");
    expect(calls.updatePatch).toMatchObject({ capacity: 20 });
  });
});
