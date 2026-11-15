import { describe, expect, it } from "vitest";
import { NOTICE_MAX_LENGTH, noticeSchema } from "../lib/validation/notices";

const base = { courseId: "", body: "No class on Poya day.", showUntil: "" };

describe("noticeSchema", () => {
  it("takes a class-wide notice with no end date", () => {
    expect(noticeSchema.safeParse(base).success).toBe(true);
  });

  it("needs some text", () => {
    expect(noticeSchema.safeParse({ ...base, body: "   " }).error?.issues[0]?.message).toBe(
      "Write the notice.",
    );
  });

  it("keeps notices short", () => {
    const body = "a".repeat(NOTICE_MAX_LENGTH + 1);
    expect(noticeSchema.safeParse({ ...base, body }).success).toBe(false);
  });

  it("turns away an end date in the past", () => {
    expect(
      noticeSchema.safeParse({ ...base, showUntil: "2000-01-01" }).error?.issues[0]?.message,
    ).toBe("Choose today or a later day.");
  });

  it("needs a real course id when there is one", () => {
    expect(noticeSchema.safeParse({ ...base, courseId: "not-a-course" }).success).toBe(false);
  });
});
