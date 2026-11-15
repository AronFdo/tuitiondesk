import { describe, expect, it } from "vitest";
import { formatSchedule, parseSchedule } from "../lib/schedule";

describe("formatSchedule", () => {
  it("writes a morning class in 12-hour time", () => {
    expect(formatSchedule("Saturday", "08:00")).toBe("Saturday 8.00am");
  });

  it("treats midnight and noon as 12", () => {
    expect(formatSchedule("Sunday", "00:00")).toBe("Sunday 12.00am");
    expect(formatSchedule("Monday", "12:30")).toBe("Monday 12.30pm");
  });

  it("writes an afternoon time", () => {
    expect(formatSchedule("Friday", "15:05")).toBe("Friday 3.05pm");
  });
});

describe("parseSchedule", () => {
  it("reads a saved class time back into day and time", () => {
    expect(parseSchedule("Saturday 8.00am")).toEqual({
      day: "Saturday",
      time: "08:00",
    });
    expect(parseSchedule("Monday 12.30pm")).toEqual({
      day: "Monday",
      time: "12:30",
    });
    expect(parseSchedule("Sunday 12.00am")).toEqual({
      day: "Sunday",
      time: "00:00",
    });
  });

  it("leaves the fields empty when the text is not a class time", () => {
    expect(parseSchedule(null)).toEqual({ day: "", time: "" });
    expect(parseSchedule("Weekends")).toEqual({ day: "", time: "" });
  });
});
