export const courseDays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function isCourseDay(value: string): value is (typeof courseDays)[number] {
  return (courseDays as readonly string[]).includes(value);
}

export function parseSchedule(text: string | null): { day: string; time: string } {
  if (!text) {
    return { day: "", time: "" };
  }
  const match =
    /^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday) (\d{1,2})\.(\d{2})(am|pm)$/.exec(
      text,
    );
  if (!match) {
    return { day: "", time: "" };
  }
  const [, day, hourText, minute, suffix] = match;
  let hour = Number(hourText) % 12;
  if (suffix === "pm") {
    hour += 12;
  }
  return { day, time: `${String(hour).padStart(2, "0")}:${minute}` };
}

export function formatSchedule(day: string, time: string): string {
  const [hourText, minuteText] = time.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const suffix = hour < 12 ? "am" : "pm";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${day} ${hour12}.${String(minute).padStart(2, "0")}${suffix}`;
}
