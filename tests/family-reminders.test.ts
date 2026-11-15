import { describe, expect, it } from "vitest";
import {
  buildReminders,
  tuitionOwed,
  type ReminderCourse,
} from "../lib/family-reminders";

const today = "2026-10-21";

const course: ReminderCourse = {
  id: "key",
  name: "Key Saturday",
  tuitionDueDay: 5,
  monthlyFeeMinor: 500_000,
  startDate: "2026-06-10",
  // September is paid, so October's fee is next, due 5 Nov.
  paidThrough: "2026-09-01",
};

describe("tuitionOwed", () => {
  it("is the next month coming up when nothing is late", () => {
    expect(tuitionOwed(course, today)).toEqual({
      months: ["2026-10-01"],
      dueOn: "2026-11-05",
      amountMinor: 500_000,
    });
  });

  it("counts every month whose due day has passed", () => {
    // July is the last month paid: August (due 5 Sep) and September (due 5 Oct) are owed.
    expect(tuitionOwed({ ...course, paidThrough: "2026-07-01" }, today)).toEqual({
      months: ["2026-08-01", "2026-09-01"],
      dueOn: "2026-09-05",
      amountMinor: 1_000_000,
    });
  });

  it("has nothing without a due day", () => {
    expect(tuitionOwed({ ...course, tuitionDueDay: null }, today)).toBeNull();
  });
});

describe("buildReminders", () => {
  it("shows tuition due soon but not a month away", () => {
    expect(buildReminders([course], "2026-10-25")).toMatchObject([
      { kind: "tuition", tone: "later", date: "2026-11-05", amountMinor: 500_000 },
    ]);
    expect(buildReminders([course], "2026-10-01")).toEqual([]);
  });

  it("marks late tuition overdue and puts it first", () => {
    const reminders = buildReminders(
      [course, { ...course, id: "late", name: "Late", paidThrough: "2026-07-01" }],
      today,
    );
    expect(reminders[0]).toMatchObject({ kind: "tuition", tone: "overdue", courseName: "Late" });
    expect(reminders[0].title).toContain("is overdue");
  });
});
