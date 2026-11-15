"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StudentAvatar } from "@/components/students/student-avatar";
import { openSession } from "@/lib/actions/attendance";
import type { RosterStudent, SessionPage } from "@/lib/attendance";
import { formatDate, formatTime } from "@/lib/dates";
import { buildWhatsAppLink } from "@/lib/messages";
import { t } from "@/lib/t";

// A finished session: who came, and a WhatsApp message ready for each absent
// student's guardian.
export function SessionSummary({ page, today }: { page: SessionPage; today: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const marks = new Map(page.marks.map((mark) => [mark.studentId, mark]));
  const present = page.roster.filter((student) => marks.has(student.id));
  const absent = page.roster.filter((student) => !marks.has(student.id));

  async function reopen() {
    setPending(true);
    setError(null);
    const result = await openSession({ courseId: page.course.id, heldOn: page.session.heldOn }).catch(() => null);
    setPending(false);
    if (!result?.ok) {
      setError(result?.error ?? t("No connection. Try again."));
      return;
    }
    router.refresh();
  }

  function absentMessage(student: RosterStudent) {
    const greeting = student.guardianName ? `${t("Dear")} ${student.guardianName}` : t("Dear Parent");
    const when = page.session.heldOn === today ? t("today") : `${t("on")} ${formatDate(page.session.heldOn)}`;
    return `${greeting}, ${student.fullName} ${t("was not at")} ${page.course.name} ${when}. ${t("Please let us know if all is well.")} - ${page.instituteName}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words">{page.course.name}</h1>
          <p className="text-slate">
            {`${formatDate(page.session.heldOn)} · ${t("Finished")} · `}
            <span className="tabular font-medium text-ink">{present.length}</span>
            {` / ${page.roster.length} ${t("here")}`}
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          className="press inline-flex h-11 items-center justify-center rounded-lg border border-line bg-surface px-4 text-sm font-medium text-forest disabled:opacity-50"
          onClick={() => void reopen()}
        >
          {pending ? t("Opening…") : t("Open again")}
        </button>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-8 md:grid-cols-2">
        <section>
          <h2>{`${t("Absent")} (${absent.length})`}</h2>
          {absent.length === 0 ? (
            <p className="mt-2 text-slate">{t("Everyone came.")}</p>
          ) : (
            <ul className="mt-2">
              {absent.map((student) => (
                <li key={student.id} className="flex min-h-16 items-center gap-3 border-b border-line py-2">
                  <StudentAvatar name={student.fullName} photoUrl={student.photoUrl} size="sm" />
                  <Link href={`/students/${student.id}`} className="min-w-0 flex-1">
                    <span className="block truncate text-ink">{student.fullName}</span>
                    <span className="tabular text-sm text-slate">{student.code}</span>
                  </Link>
                  {student.guardianPhone ? (
                    <a
                      href={buildWhatsAppLink(student.guardianPhone, absentMessage(student))}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${t("Tell guardian")}, ${student.fullName}`}
                      className="inline-flex h-11 shrink-0 items-center rounded-lg border border-line bg-surface px-3 text-sm font-medium text-forest"
                    >
                      {t("Tell guardian")}
                    </a>
                  ) : (
                    <span className="shrink-0 text-sm text-slate">{t("No phone")}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2>{`${t("Here")} (${present.length})`}</h2>
          {present.length === 0 ? (
            <p className="mt-2 text-slate">{t("Nobody was marked here.")}</p>
          ) : (
            <ul className="mt-2">
              {present.map((student) => {
                const mark = marks.get(student.id);
                return (
                  <li key={student.id} className="flex min-h-16 items-center gap-3 border-b border-line py-2">
                    <StudentAvatar name={student.fullName} photoUrl={student.photoUrl} size="sm" />
                    <span className="min-w-0 flex-1 break-words text-ink">{student.fullName}</span>
                    <span className="shrink-0 text-sm text-slate">{mark ? formatTime(mark.scannedAt) : ""}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
