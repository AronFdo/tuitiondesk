import { formatDate } from "@/lib/dates";
import type { Reminder, ReminderTone } from "@/lib/family-reminders";
import { formatLkr } from "@/lib/money";
import { t } from "@/lib/t";

const toneClass: Record<ReminderTone, string> = {
  overdue: "bg-[var(--status-overdue-bg)] text-[var(--status-overdue-fg)]",
  soon: "bg-[var(--status-due-bg)] text-[var(--status-due-fg)]",
  later: "bg-[var(--status-muted-bg)] text-[var(--status-muted-fg)]",
};

const toneLabel: Record<ReminderTone, string> = {
  overdue: "Overdue",
  soon: "Soon",
  later: "Coming up",
};

export function ReminderList({ reminders }: { reminders: Reminder[] }) {
  if (reminders.length === 0) {
    return <p className="mt-2 text-slate">{t("Nothing due right now.")}</p>;
  }
  return (
    <ul className="mt-2">
      {reminders.map((reminder) => (
        <li key={reminder.id} className="flex flex-col gap-1 border-b border-line py-3">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 font-medium text-ink">{reminder.title}</p>
            {reminder.amountMinor ? (
              <p className="tabular shrink-0 font-medium text-ink">
                {formatLkr(reminder.amountMinor)}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate">
            <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${toneClass[reminder.tone]}`}>
              {t(toneLabel[reminder.tone])}
            </span>
            <span>{reminder.courseName}</span>
            {reminder.date ? <span>· {formatDate(reminder.date)}</span> : null}
          </div>
          {reminder.lines.length > 0 ? (
            <ul className="mt-1 list-disc pl-5 text-sm text-ink">
              {reminder.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
