import { formatDate } from "@/lib/dates";
import { formatLkr } from "@/lib/money";
import { buildWhatsAppLink } from "@/lib/messages";
import type { NextDue } from "@/lib/student-context";
import { t } from "@/lib/t";

// A WhatsApp click-to-send message to the guardian, about the next fee due.
export function GuardianReminder({
  fullName,
  guardianName,
  guardianPhone,
  nextDue,
}: {
  fullName: string;
  guardianName: string | null;
  guardianPhone: string | null;
  nextDue: NextDue | null;
}) {
  if (!guardianPhone) {
    return <p className="text-sm text-slate">{t("Add a guardian phone to send reminders.")}</p>;
  }
  const href = buildWhatsAppLink(guardianPhone, reminderMessage(fullName, guardianName, nextDue));
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-line bg-surface text-sm font-medium text-forest md:w-auto md:px-4"
    >
      <WhatsAppMark />
      {t("Send reminder")}
    </a>
  );
}

export function dueLine(due: NextDue | null) {
  if (!due) {
    return t("Nothing due");
  }
  const amount = due.amountMinor ? ` · ${formatLkr(due.amountMinor)}` : "";
  return `${t("Tuition")} · ${due.courseName} · ${formatDate(due.date)}${amount}`;
}

function reminderMessage(fullName: string, guardianName: string | null, due: NextDue | null) {
  const greeting = guardianName ? `${t("Dear")} ${guardianName}` : t("Dear Parent");
  if (!due) {
    return `${greeting}, ${t("a kind reminder about")} ${fullName}.`;
  }
  const amount = due.amountMinor ? ` (${formatLkr(due.amountMinor)})` : "";
  return `${greeting}, ${t("a kind reminder that")} ${fullName}'s ${t("tuition")} ${t("for")} ${due.courseName} ${t("is due on")} ${formatDate(due.date)}${amount}.`;
}

function WhatsAppMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#25D366"
        d="M12.04 2C6.58 2 2.15 6.4 2.15 11.83c0 1.74.46 3.44 1.34 4.94L2 22l5.39-1.41a10 10 0 0 0 4.65 1.18h.01c5.46 0 9.89-4.4 9.89-9.83C21.94 6.4 17.5 2 12.04 2zm5.76 13.89c-.24.68-1.4 1.3-1.94 1.38-.5.08-1.13.11-1.82-.11-.42-.14-.95-.31-1.64-.6-2.88-1.24-4.76-4.14-4.9-4.33-.14-.19-1.16-1.54-1.16-2.94s.73-2.08 1-2.37c.24-.27.64-.39.85-.39.21 0 .42 0 .6.01.19.01.45-.07.7.53.26.64.88 2.2.96 2.36.08.16.13.35.03.56-.1.21-.16.34-.31.53-.16.18-.33.41-.47.55-.16.16-.32.33-.14.64.19.31.83 1.37 1.78 2.22 1.23 1.09 2.26 1.43 2.58 1.59.32.16.5.13.69-.08.19-.21.8-.93 1.01-1.25.21-.32.42-.27.7-.16.28.11 1.79.84 2.1.99.31.16.51.23.59.36.07.13.07.75-.17 1.43z"
      />
    </svg>
  );
}
