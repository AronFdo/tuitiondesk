import { describe, expect, it } from "vitest";
import { courseHistory, durationLabel, monthsBetween, outcomeLabel } from "@/lib/course-history";

describe("monthsBetween", () => {
  it("counts whole months and rounds a part month from 15 days", () => {
    expect(monthsBetween("2026-01-10", "2026-01-20")).toBe(0);
    expect(monthsBetween("2026-01-10", "2026-01-25")).toBe(1);
    expect(monthsBetween("2026-01-10", "2026-10-10")).toBe(9);
    expect(monthsBetween("2026-01-31", "2026-03-01")).toBe(1);
    expect(monthsBetween("2026-01-10", "2027-01-09")).toBe(12);
  });

  it("never goes below zero", () => {
    expect(monthsBetween("2026-05-01", "2026-04-01")).toBe(0);
  });
});

describe("durationLabel", () => {
  it("reads naturally", () => {
    expect(durationLabel("2026-01-10", "2026-01-12")).toBe("under a month");
    expect(durationLabel("2026-01-10", "2026-02-10")).toBe("1 month");
    expect(durationLabel("2026-01-10", "2026-11-16")).toBe("10 months");
    expect(durationLabel("2025-01-10", "2026-01-10")).toBe("1 year");
    expect(durationLabel("2024-01-10", "2026-03-10")).toBe("2 years 2 months");
  });
});

describe("outcomeLabel", () => {
  it("labels every outcome and nothing else", () => {
    expect(outcomeLabel("promoted")).toBe("Moved up to the next course");
    expect(outcomeLabel("left")).toBe("Left the institute");
    expect(outcomeLabel(null)).toBeNull();
    expect(outcomeLabel("nope")).toBeNull();
  });
});

describe("courseHistory", () => {
  const names = new Map([
    ["a", "IELTS"],
    ["b", "PTE"],
  ]);

  it("lists current courses first, then the latest ended", () => {
    const items = courseHistory(
      [
        { id: "1", course_id: "a", start_date: "2025-01-10", end_date: "2025-06-30", outcome: "completed" },
        { id: "2", course_id: "b", start_date: "2025-07-01", end_date: null, outcome: null },
        { id: "3", course_id: "gone", start_date: "2025-03-01", end_date: "2025-09-01", outcome: null },
      ],
      names,
      "2026-01-01",
    );
    expect(items.map((item) => item.id)).toEqual(["2", "3", "1"]);
    expect(items[0]).toMatchObject({ current: true, dates: "Since 1 Jul 2025", duration: "6 months", outcome: null });
    expect(items[1]).toMatchObject({ courseName: "Deleted course", outcome: "Ended" });
    expect(items[2]).toMatchObject({ dates: "10 Jan 2025 – 30 Jun 2025", outcome: "Completed" });
  });
});
