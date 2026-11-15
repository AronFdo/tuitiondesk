import { describe, expect, it } from "vitest";
import { daysBetween, previousMonth } from "../lib/dates";

describe("daysBetween", () => {
  it("counts days forward and backward", () => {
    expect(daysBetween("2026-10-11", "2026-10-17")).toBe(6);
    expect(daysBetween("2026-10-11", "2026-10-11")).toBe(0);
    expect(daysBetween("2026-10-11", "2026-10-09")).toBe(-2);
  });

  it("crosses month and year ends", () => {
    expect(daysBetween("2026-12-30", "2027-01-02")).toBe(3);
  });
});

describe("previousMonth", () => {
  it("steps back one month", () => {
    expect(previousMonth("2026-11-01")).toBe("2026-10");
  });

  it("rolls back the year in January", () => {
    expect(previousMonth("2027-01-01")).toBe("2026-12");
  });
});
