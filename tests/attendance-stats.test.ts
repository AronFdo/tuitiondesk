import { describe, expect, it } from "vitest";
import { studentAttendance } from "../lib/attendance-stats";

describe("studentAttendance", () => {
  const sessions = [
    { id: "s1", courseId: "b1", heldOn: "2026-10-01" },
    { id: "s2", courseId: "b1", heldOn: "2026-10-08" },
    { id: "s3", courseId: "b1", heldOn: "2026-10-15" },
    { id: "s4", courseId: "a2", heldOn: "2026-10-02" },
  ];

  it("counts only sessions since the student joined, newest first", () => {
    const [b1] = studentAttendance(
      [{ courseId: "b1", courseName: "B1", startDate: "2026-10-05" }],
      sessions,
      new Set(["s3"]),
    );
    expect(b1).toMatchObject({ held: 2, present: 1, rate: 50 });
    expect(b1.sessions.map((session) => session.id)).toEqual(["s3", "s2"]);
  });

  it("has no rate before any session", () => {
    const [a2] = studentAttendance(
      [{ courseId: "a2", courseName: "A2", startDate: "2026-11-01" }],
      sessions,
      new Set(),
    );
    expect(a2).toMatchObject({ held: 0, present: 0, rate: null });
  });
});
