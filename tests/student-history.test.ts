import { describe, expect, it } from "vitest";
import { describeHistory, formatValue, historyChanges } from "@/lib/student-history-format";

const row = (action: string, data: unknown, actor: string | null = "p1") => ({
  id: "r1",
  action,
  data,
  created_at: "2026-11-16T04:30:00Z",
  actor_profile_id: actor,
});

describe("formatValue", () => {
  it("shows blanks, booleans, phones, dates and labelled choices", () => {
    expect(formatValue("notes", null)).toBe("—");
    expect(formatValue("notes", "")).toBe("—");
    expect(formatValue("has_special_needs", true)).toBe("Yes");
    expect(formatValue("guardian_phone", "+94771234567")).toBe("0771234567");
    expect(formatValue("date_of_birth", "2010-03-05")).toBe("5 Mar 2010");
    expect(formatValue("medium", "sinhala")).toBe("Sinhala");
    expect(formatValue("gender", "female")).toBe("Female");
  });
});

describe("historyChanges", () => {
  it("labels each change in page order and skips malformed ones", () => {
    const changes = historyChanges({
      notes: ["old", "new"],
      full_name: ["Amal Perera", "Amal Silva"],
      course_id: ["a", "b"],
      broken: "nope",
    });
    expect(changes).toEqual([
      { label: "Name", from: "Amal Perera", to: "Amal Silva" },
      { label: "Notes", from: "old", to: "new" },
    ]);
  });

  it("returns nothing for missing data", () => {
    expect(historyChanges(undefined)).toEqual([]);
    expect(historyChanges(null)).toEqual([]);
  });
});

describe("describeHistory", () => {
  const names = new Map([["p1", "Nimali"]]);

  it("uses the stored actor name before looking one up", () => {
    const entry = describeHistory(row("student_updated", { actor_name: "Kasun", changes: {} }), names);
    expect(entry.actorName).toBe("Kasun");
    expect(entry.title).toBe("Details changed");
  });

  it("falls back to the profile name, former staff, then system", () => {
    expect(describeHistory(row("student_updated", {}), names).actorName).toBe("Nimali");
    expect(describeHistory(row("student_updated", {}, "gone"), names).actorName).toBe("Former staff");
    expect(describeHistory(row("student_updated", {}, null), names).actorName).toBe("System");
  });

  it("names the course and date for course moves", () => {
    const started = describeHistory(
      row("enrollment_started", { course_name: "IELTS", start_date: "2026-01-10" }),
      names,
    );
    expect(started.title).toBe("Joined a course");
    expect(started.detail).toBe("IELTS from 10 Jan 2026");

    const ended = describeHistory(
      row("enrollment_ended", { course_name: "IELTS", end_date: "2026-10-31" }),
      names,
    );
    expect(ended.detail).toBe("IELTS on 31 Oct 2026");
  });

  it("adds the outcome and leaving details", () => {
    const ended = describeHistory(
      row("enrollment_ended", { course_name: "IELTS", end_date: "2026-10-31", outcome: "promoted" }),
      names,
    );
    expect(ended.detail).toBe("IELTS on 31 Oct 2026 · Moved up to the next course");

    const left = describeHistory(
      row("student_left", { left_on: "2026-11-16", leave_reason: "moved_away", leave_note: "To Kandy" }),
      names,
    );
    expect(left.title).toBe("Left the institute");
    expect(left.detail).toBe("Last day 16 Nov 2026 · Moved away · To Kandy");
  });

  it("keeps unknown actions readable", () => {
    expect(describeHistory(row("something_new", null), names).title).toBe("something new");
  });
});
