// Tuition is paid in arrears: a month's fee is due on the due day of the
// following month. The next fee due is for the month after the last one paid,
// or for the month the student joined when nothing has been paid.
export function nextTuitionDate(
  dueDay: number,
  lastPeriodMonth: string | null,
  startDate: string,
): string {
  const [year, month] = (lastPeriodMonth ?? startDate).split("-").map(Number);
  // One month on from the period owed, plus one more past the last paid month.
  const ahead = lastPeriodMonth ? 2 : 1;
  const index = year * 12 + (month - 1) + ahead;
  return dateWithDay(Math.floor(index / 12), (index % 12) + 1, dueDay);
}

function dateWithDay(year: number, month: number, dueDay: number) {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(Math.max(dueDay, 1), lastDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// The next date that falls on a monthly due day, today included.
export function nextDateForDay(dueDay: number, today: string): string {
  const [year, month] = today.split("-").map(Number);
  const thisMonth = dateWithDay(year, month, dueDay);
  if (thisMonth >= today) {
    return thisMonth;
  }
  return month === 12 ? dateWithDay(year + 1, 1, dueDay) : dateWithDay(year, month + 1, dueDay);
}
