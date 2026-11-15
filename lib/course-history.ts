import { formatDate } from "@/lib/dates";
import { t } from "@/lib/t";

// Why a course ended (enrollments.outcome, supabase/sql/027). "left" is set
// only by marking the student as left, so the edit page offers the others.
export const COURSE_OUTCOMES = [
  { value: "completed", label: "Completed" },
  { value: "promoted", label: "Moved up to the next course" },
  { value: "withdrawn", label: "Stopped" },
] as const;

export type CourseOutcome = (typeof COURSE_OUTCOMES)[number]["value"] | "left";

export function outcomeLabel(value: string | null): string | null {
  if (value === "left") {
    return t("Left the institute");
  }
  const found = COURSE_OUTCOMES.find((item) => item.value === value);
  return found ? t(found.label) : null;
}

export function isCourseOutcome(value: string): value is (typeof COURSE_OUTCOMES)[number]["value"] {
  return COURSE_OUTCOMES.some((item) => item.value === value);
}

export const LEAVE_REASONS = [
  { value: "completed", label: "Finished their studies" },
  { value: "moved_away", label: "Moved away" },
  { value: "other_institute", label: "Joined another institute" },
  { value: "cost", label: "Could not keep paying fees" },
  { value: "personal", label: "Personal or family reasons" },
  { value: "other", label: "Other" },
] as const;

export type LeaveReason = (typeof LEAVE_REASONS)[number]["value"];

export function leaveReasonLabel(value: string | null): string | null {
  const found = LEAVE_REASONS.find((item) => item.value === value);
  return found ? t(found.label) : null;
}

export function isLeaveReason(value: string): value is LeaveReason {
  return LEAVE_REASONS.some((item) => item.value === value);
}

// Whole months from start to end (inclusive of a part month once 15 days
// have passed), for "10 months" beside a course. Dates are YYYY-MM-DD.
export function monthsBetween(start: string, end: string): number {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  if (!sy || !sm || !sd || !ey || !em || !ed) {
    return 0;
  }
  let months = (ey - sy) * 12 + (em - sm);
  const days = ed - sd;
  if (days < 0) {
    months -= 1;
  }
  const leftover = days < 0 ? days + 30 : days;
  if (leftover >= 15) {
    months += 1;
  }
  return Math.max(months, 0);
}

export function durationLabel(start: string, end: string): string {
  const months = monthsBetween(start, end);
  if (months === 0) {
    return t("under a month");
  }
  if (months < 12) {
    return months === 1 ? t("1 month") : `${months} ${t("months")}`;
  }
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const yearText = years === 1 ? t("1 year") : `${years} ${t("years")}`;
  if (rest === 0) {
    return yearText;
  }
  return `${yearText} ${rest === 1 ? t("1 month") : `${rest} ${t("months")}`}`;
}

export type EnrollmentRow = {
  id: string;
  course_id: string;
  start_date: string;
  end_date: string | null;
  outcome: string | null;
};

export type CourseHistoryItem = {
  id: string;
  courseId: string;
  courseName: string;
  current: boolean;
  // "10 Jan 2026 – 16 Nov 2026" or "Since 10 Jan 2026".
  dates: string;
  duration: string;
  outcome: string | null;
};

// Every course the student has been on, current ones first, then the most
// recently ended.
export function courseHistory(
  rows: EnrollmentRow[],
  courseNames: Map<string, string>,
  today: string,
): CourseHistoryItem[] {
  return [...rows]
    .sort((a, b) => {
      if ((a.end_date === null) !== (b.end_date === null)) {
        return a.end_date === null ? -1 : 1;
      }
      const byEnd = (b.end_date ?? "").localeCompare(a.end_date ?? "");
      return byEnd !== 0 ? byEnd : b.start_date.localeCompare(a.start_date);
    })
    .map((row) => ({
      id: row.id,
      courseId: row.course_id,
      courseName: courseNames.get(row.course_id) ?? t("Deleted course"),
      current: row.end_date === null,
      dates:
        row.end_date === null
          ? `${t("Since")} ${formatDate(row.start_date)}`
          : `${formatDate(row.start_date)} – ${formatDate(row.end_date)}`,
      duration: durationLabel(row.start_date, row.end_date ?? today),
      outcome: row.end_date === null ? null : (outcomeLabel(row.outcome) ?? t("Ended")),
    }));
}
