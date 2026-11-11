import { describe, expect, it } from "vitest";
import { eventInput } from "@/lib/events.functions";

const base = {
  title: "Harvest Gala",
  starts_at: "2026-12-01T18:00",
};

describe("event type is a fillable text field", () => {
  it("accepts any wording the admin types", () => {
    expect(eventInput.parse({ ...base, type: "Gala Night" }).type).toBe("Gala Night");
    expect(eventInput.parse({ ...base, type: "Agricultural exhibition" }).type).toBe(
      "Agricultural exhibition",
    );
  });

  it("trims surrounding spaces but keeps the wording as typed", () => {
    expect(eventInput.parse({ ...base, type: "  Fashion Show  " }).type).toBe("Fashion Show");
  });

  it("rejects an empty type", () => {
    expect(() => eventInput.parse({ ...base, type: "   " })).toThrow();
  });

  it("defaults to workshop when no type is supplied", () => {
    expect(eventInput.parse(base).type).toBe("workshop");
  });
});
