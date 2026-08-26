import { describe, expect, it } from "vitest";

import { logClassCancellation } from "@/lib/class-cancellations/queries";

/**
 * Requirement (Step 4): a cancellation-logging query helper that snapshots a
 * class's label fields + its current roster into one `class_cancellations`
 * audit row.
 *
 * Contract asserted here (informs the builder):
 *   logClassCancellation(supabase, { classId, canceledBy })
 *     - reads the class row's label fields (name, class_date, start_time) from
 *       the "classes" table for `classId`,
 *     - reuses getClassRoster(supabase, classId) — which itself reads
 *       "bookings" then "members"/"profiles" — to gather the roster of
 *       { userId, name, email } attendees,
 *     - inserts EXACTLY ONE row into "class_cancellations" containing the
 *       snapshot label fields, canceled_by = canceledBy, booked_count = number
 *       of roster entries, and roster = the roster identities,
 *     - throws if the insert returns an error.
 *
 * The stub client below implements the chainable Supabase shape this repo uses
 * (see lib/classes/roster.ts and lib/classes/queries.ts):
 *   - "classes":  .from("classes").select(cols).eq("id", id).maybeSingle()/single()
 *   - "bookings": .from("bookings").select("user_id").eq("class_id", id)  -> { data, error }
 *   - "members":  .from("members").select(cols).in("auth_user_id", ids)   -> { data, error }
 *   - "profiles": .from("profiles").select(cols).in("id", ids)            -> { data, error }
 *   - insert:     .from("class_cancellations").insert(payload)            -> { error }
 *
 * We drive the roster by seeding the "bookings"/"members" reads that
 * getClassRoster performs, rather than stubbing getClassRoster itself, so the
 * roster shape asserted here is exactly what getClassRoster really returns.
 */

type Member = { auth_user_id: string; full_name: string | null; email: string | null };

type StubOptions = {
  classRow: { name: string; class_date: string; start_time: string };
  bookingUserIds: string[];
  members: Member[];
};

function makeStubClient({ classRow, bookingUserIds, members }: StubOptions) {
  const inserts: { table: string; payload: Record<string, unknown> }[] = [];

  const client = {
    from(table: string) {
      if (table === "classes") {
        return {
          select(_cols: string) {
            const chain = {
              eq(_col: string, _val: unknown) {
                const result = { data: classRow, error: null };
                return {
                  maybeSingle: async () => result,
                  single: async () => result
                };
              }
            };
            return chain;
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
          insert(payload: Record<string, unknown>) {
            inserts.push({ table, payload });
            return Promise.resolve({ error: null });
          }
        };
      }

      throw new Error(`unexpected table in stub: ${table}`);
    }
  };

  return { client, inserts };
}

const classRow = { name: "Sunrise Flow", class_date: "2026-09-01", start_time: "07:00" };

describe("logClassCancellation — snapshot class + roster into class_cancellations", () => {
  it("inserts exactly one row with booked_count 2 and a roster carrying both user ids", async () => {
    const { client, inserts } = makeStubClient({
      classRow,
      bookingUserIds: ["user_a", "user_b"],
      members: [
        { auth_user_id: "user_a", full_name: "Ann", email: "ann@example.com" },
        { auth_user_id: "user_b", full_name: "Ben", email: "ben@example.com" }
      ]
    });

    await logClassCancellation(client as never, { classId: "class_abc", canceledBy: "admin_1" });

    expect(inserts).toHaveLength(1);
    const { table, payload } = inserts[0];
    expect(table).toBe("class_cancellations");
    expect(payload.canceled_by).toBe("admin_1");
    expect(payload.booked_count).toBe(2);

    const roster = payload.roster as Array<{ userId: string }>;
    expect(Array.isArray(roster)).toBe(true);
    expect(roster).toHaveLength(2);
    const rosterUserIds = roster.map((entry) => entry.userId);
    expect(rosterUserIds).toEqual(expect.arrayContaining(["user_a", "user_b"]));
  });

  it("inserts exactly one row with booked_count 0 and an empty roster when nobody is booked", async () => {
    const { client, inserts } = makeStubClient({
      classRow,
      bookingUserIds: [],
      members: []
    });

    await logClassCancellation(client as never, { classId: "class_empty", canceledBy: "admin_1" });

    expect(inserts).toHaveLength(1);
    const { table, payload } = inserts[0];
    expect(table).toBe("class_cancellations");
    expect(payload.canceled_by).toBe("admin_1");
    expect(payload.booked_count).toBe(0);

    const roster = payload.roster as unknown[];
    expect(Array.isArray(roster)).toBe(true);
    expect(roster).toHaveLength(0);
  });
});
