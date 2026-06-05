// tests/unit/helpers.test.js
import { describe, it, expect } from "vitest";
import { sortReservationsByCreatedAt, firstPromotable } from "../../helpers/promotion.js";

describe("Waitlist promotion helpers @unit", () => {

  // TC-G7-031
  it("TC-G7-031 sortReservationsByCreatedAt sorts ascending by createdAt", () => {
    const input = [
      { id: "C", createdAt: "2026-01-03T10:00:00Z", status: "pending" },
      { id: "A", createdAt: "2026-01-01T10:00:00Z", status: "pending" },
      { id: "B", createdAt: "2026-01-02T10:00:00Z", status: "pending" },
    ];
    const sorted = sortReservationsByCreatedAt(input);
    expect(sorted.map((r) => r.id)).toEqual(["A", "B", "C"]);

    // input must not be mutated
    expect(input.map((r) => r.id)).toEqual(["C", "A", "B"]);
  });

  // TC-G7-032
  it("TC-G7-032 firstPromotable skips cancelled reservations and returns oldest pending", () => {
    const input = [
      { id: "X", createdAt: "2026-01-01T10:00:00Z", status: "cancelled" },
      { id: "Y", createdAt: "2026-01-02T10:00:00Z", status: "pending" },
      { id: "Z", createdAt: "2026-01-03T10:00:00Z", status: "pending" },
    ];
    const result = firstPromotable(input);
    expect(result).not.toBeNull();
    expect(result.id).toBe("Y");

    // Empty list returns null
    expect(firstPromotable([])).toBeNull();

    // Only cancelled returns null
    expect(firstPromotable([{ id: "C1", createdAt: "2026-01-01T10:00:00Z", status: "cancelled" }])).toBeNull();
  });
});
