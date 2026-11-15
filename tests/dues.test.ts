import { describe, expect, it } from "vitest";
import { nextDateForDay, nextTuitionDate } from "../lib/dues";

describe("nextTuitionDate", () => {
  it("is due the month after joining when nothing has been paid", () => {
    expect(nextTuitionDate(1, null, "2026-10-20")).toBe("2026-11-01");
  });

  it("is due two months after the last paid month", () => {
    // October is paid on 1 Nov, so November's fee is next, due 1 Dec.
    expect(nextTuitionDate(1, "2026-10-01", "2026-08-01")).toBe("2026-12-01");
  });

  it("rolls over the year", () => {
    expect(nextTuitionDate(5, "2026-11-01", "2026-08-01")).toBe("2027-01-05");
  });

  it("uses the last day of a short month", () => {
    expect(nextTuitionDate(31, "2026-01-01", "2025-12-01")).toBe("2026-03-31");
    expect(nextTuitionDate(31, null, "2026-01-15")).toBe("2026-02-28");
  });
});

describe("nextDateForDay", () => {
  it("uses this month while the day is still ahead or today", () => {
    expect(nextDateForDay(15, "2026-10-11")).toBe("2026-10-15");
    expect(nextDateForDay(11, "2026-10-11")).toBe("2026-10-11");
  });

  it("moves to next month once the day has passed", () => {
    expect(nextDateForDay(5, "2026-10-11")).toBe("2026-11-05");
  });

  it("rolls over the year", () => {
    expect(nextDateForDay(5, "2026-12-20")).toBe("2027-01-05");
  });

  it("uses the last day of a short month", () => {
    expect(nextDateForDay(31, "2026-02-10")).toBe("2026-02-28");
  });
});
