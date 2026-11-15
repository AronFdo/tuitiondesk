import { daysBetween, formatMonth, previousMonth } from "@/lib/dates";
import { nextTuitionDate } from "@/lib/dues";
import { t } from "@/lib/t";

// What a parent is reminded of in the portal, worked out from what the class
// already records. Nothing here is stored.

export type ReminderTone = "overdue" | "soon" | "later";

export type Reminder = {
  id: string;
  kind: "tuition";
  title: string;
  courseName: string;
  // The day it is due or happens; null when the class has not set one.
  date: string | null;
  amountMinor: number | null;
  tone: ReminderTone;
  // Extra lines, such as which details the class still needs.
  lines: string[];
};

export type ReminderCourse = {
  id: string;
  name: string;
  tuitionDueDay: number | null;
  monthlyFeeMinor: number;
  // When the child joined this course.
  startDate: string;
  // The latest month paid (YYYY-MM-DD, first of the month), if any.
  paidThrough: string | null;
};

// How far ahead each kind shows on the home screen.
export const REMINDER_HORIZON_DAYS = {
  tuition: 14,
} as const;

const SOON_DAYS = 7;

export type TuitionOwed = {
  // The months owed, oldest first, as YYYY-MM-DD (first of the month).
  months: string[];
  // When the oldest owed month was or is due.
  dueOn: string;
  amountMinor: number;
};

// Tuition is paid in arrears (see nextTuitionDate). Every month whose due day
// has passed without a payment is owed; when none is, the next month coming
// up is returned instead, so there is always something to show.
export function tuitionOwed(course: ReminderCourse, today: string): TuitionOwed | null {
  if (!course.tuitionDueDay) {
    return null;
  }
  const first = nextTuitionDate(course.tuitionDueDay, course.paidThrough, course.startDate);
  const months: string[] = [];
  let due = first;
  // A year is plenty; past that the class has bigger things to talk about.
  while (due <= today && months.length < 12) {
    const period = `${previousMonth(due)}-01`;
    months.push(period);
    due = nextTuitionDate(course.tuitionDueDay, period, course.startDate);
  }
  if (months.length === 0) {
    months.push(`${previousMonth(first)}-01`);
  }
  return {
    months,
    dueOn: first,
    amountMinor: course.monthlyFeeMinor * months.length,
  };
}

function toneFor(date: string, today: string): ReminderTone {
  const days = daysBetween(today, date);
  if (days < 0) {
    return "overdue";
  }
  return days <= SOON_DAYS ? "soon" : "later";
}

function within(date: string, today: string, horizon: number) {
  return daysBetween(today, date) <= horizon;
}

export function buildReminders(courses: ReminderCourse[], today: string): Reminder[] {
  const reminders: Reminder[] = [];

  for (const course of courses) {
    const owed = tuitionOwed(course, today);
    if (!owed || !within(owed.dueOn, today, REMINDER_HORIZON_DAYS.tuition)) {
      continue;
    }
    const overdue = owed.dueOn < today;
    const title =
      owed.months.length === 1
        ? `${t("Tuition for")} ${formatMonth(owed.months[0])}`
        : `${t("Tuition for")} ${owed.months.length} ${t("months")} (${formatMonth(owed.months[0])} – ${formatMonth(owed.months[owed.months.length - 1])})`;
    reminders.push({
      id: `tuition:${course.id}`,
      kind: "tuition",
      title: overdue ? `${title} ${t("is overdue")}` : `${title} ${t("is due")}`,
      courseName: course.name,
      date: owed.dueOn,
      amountMinor: owed.amountMinor > 0 ? owed.amountMinor : null,
      tone: toneFor(owed.dueOn, today),
      lines: [],
    });
  }

  const rank: Record<ReminderTone, number> = { overdue: 0, soon: 1, later: 2 };
  return reminders.sort(
    (a, b) =>
      rank[a.tone] - rank[b.tone] ||
      (a.date ?? "9999").localeCompare(b.date ?? "9999") ||
      a.id.localeCompare(b.id),
  );
}
