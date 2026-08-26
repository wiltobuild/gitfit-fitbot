import { describe, expect, it } from "vitest";
import { resolveClassType } from "@/lib/chatbot/entity-extraction";

describe("resolveClassType", () => {
  it("resolves the original three class types", () => {
    expect(resolveClassType("book me into a yoga class")).toBe("yoga");
    expect(resolveClassType("book me into cycling")).toBe("cycling");
    expect(resolveClassType("book me into hiit")).toBe("hiit");
  });

  it("resolves the previously-missing class types", () => {
    expect(resolveClassType("book me into a boxing class")).toBe("boxing");
    expect(resolveClassType("book me into a pilates class")).toBe("pilates");
    expect(resolveClassType("book me into strength training")).toBe("strength");
  });

  it("returns undefined when no class type is mentioned", () => {
    expect(resolveClassType("what classes are open tomorrow")).toBeUndefined();
  });
});
