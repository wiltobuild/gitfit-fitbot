import { describe, expect, it } from "vitest";
import { resolveInstructor } from "@/lib/chatbot/entity-extraction";

describe("resolveInstructor", () => {
  it("resolves the original three instructors", () => {
    expect(resolveInstructor("book me into sofia's class")).toBe("sofia martinez");
    expect(resolveInstructor("what is marcus teaching today")).toBe("marcus lee");
    expect(resolveInstructor("i want avery's hiit class")).toBe("avery thompson");
  });

  it("resolves the previously-missing instructors added with boxing, pilates, and strength", () => {
    expect(resolveInstructor("book me into diego's boxing class")).toBe("diego reyes");
    expect(resolveInstructor("what is elena teaching today")).toBe("elena cruz");
    expect(resolveInstructor("i want jordan's strength class")).toBe("jordan blake");
  });

  it("returns undefined when no instructor is mentioned", () => {
    expect(resolveInstructor("what classes are open tomorrow")).toBeUndefined();
  });
});
