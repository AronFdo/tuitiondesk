import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { StartAttendance } from "@/components/attendance/start-attendance";
import { loadAttendanceHome, type SessionSummary } from "@/lib/attendance";
import { formatDate } from "@/lib/dates";
import { t } from "@/lib/t";

export default function AttendancePage() {
  return (
    <Suspense fallback={<p className="text-slate">{t("Loading…")}</p>}>
      <AttendanceHome />
    </Suspense>
  );
}

async function AttendanceHome() {
  const home = await loadAttendanceHome();
  if (home.status === "signed-out") {
    redirect("/sign-in");
  }
  if (home.status === "error") {
    return (
      <div>
        <h1>{t("Attendance")}</h1>
        <p className="mt-2 max-w-md text-slate">
          {home.missing
            ? t("Attendance is not set up yet. Run 019_attendance.sql in Supabase, then refresh.")
            : t("Attendance could not be loaded. Refresh the page to try again.")}
        </p>
      </div>
    );
  }

  const open = home.sessions.filter((session) => session.open);
  const past = home.sessions.filter((session) => !session.open);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1>{t("Attendance")}</h1>
        <p className="mt-1 max-w-xl text-slate">
          {t("Start attendance for a class, then scan each student's card as they come in.")}
        </p>
      </div>

      <section>
        <StartAttendance courses={home.courses} today={home.today} />
      </section>

      {open.length > 0 ? (
        <section>
          <h2>{t("Taking attendance now")}</h2>
          <SessionList sessions={open} today={home.today} />
        </section>
      ) : null}

      <section>
        <h2>{t("Earlier")}</h2>
        {past.length === 0 ? (
          <p className="mt-2 text-slate">{t("No attendance taken yet.")}</p>
        ) : (
          <SessionList sessions={past} today={home.today} />
        )}
      </section>
    </div>
  );
}

function SessionList({
  sessions,
  today,
}: {
  sessions: SessionSummary[];
  today: string;
}) {
  return (
    <ul className="mt-2">
      {sessions.map((session) => (
        <li key={session.id} className="border-b border-line">
          <Link href={`/attendance/${session.id}`} className="row pressable justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate text-ink">{session.courseName}</span>
              <span className="text-sm text-slate">
                {session.heldOn === today ? t("Today") : formatDate(session.heldOn)}
              </span>
            </span>
            <span className="tabular shrink-0 text-sm text-slate">
              {`${session.present} / ${session.enrolled} ${t("here")}`}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
