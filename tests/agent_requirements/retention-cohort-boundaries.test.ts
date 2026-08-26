import { describe, expect, it } from "vitest";
import { cohortBoundaries } from "@/lib/retention/cohort-boundaries";

describe("retention cohort boundaries", () => {
  it("has no day shared between two adjacent cohorts", () => {
    for (let i = 0; i < cohortBoundaries.length - 1; i++) {
      const current = cohortBoundaries[i];
      const next = cohortBoundaries[i + 1];
      expect(current.maxDays).toBeLessThan(next.minDays);
    }
  });

  it("still covers the original 7-60 day staleness range with no gaps", () => {
    expect(cohortBoundaries[0].minDays).toBe(7);
    expect(cohortBoundaries[cohortBoundaries.length - 1].maxDays).toBe(60);
    for (let i = 0; i < cohortBoundaries.length - 1; i++) {
      expect(cohortBoundaries[i + 1].minDays).toBe(cohortBoundaries[i].maxDays + 1);
    }
  });
});
