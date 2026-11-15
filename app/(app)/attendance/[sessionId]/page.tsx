import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ScanScreen } from "@/components/attendance/scan-screen";
import { SessionSummary } from "@/components/attendance/session-summary";
import { loadSessionPage } from "@/lib/attendance";
import { colomboToday } from "@/lib/dates";
import { t } from "@/lib/t";

type Params = Promise<{ sessionId: string }>;

export default function AttendanceSessionPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<p className="text-slate">{t("Loading…")}</p>}>
      <Session params={params} />
    </Suspense>
  );
}

async function Session({ params }: { params: Params }) {
  const { sessionId } = await params;
  const result = await loadSessionPage(sessionId);
  if (result.status === "signed-out") {
    redirect("/sign-in");
  }
  const back = (
    <Link href="/attendance" className="text-sm text-forest">
      {t("Attendance")}
    </Link>
  );
  if (result.status === "not-found") {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <p className="text-slate">{t("That attendance session is not in this class, or it is for a class you do not teach.")}</p>
      </div>
    );
  }
  if (result.status === "error") {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <p className="max-w-md text-slate">
          {result.missing
            ? t("Attendance is not set up yet. Run 019_attendance.sql in Supabase, then refresh.")
            : t("This attendance session could not be loaded. Refresh the page to try again.")}
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {back}
      {result.page.session.open ? (
        <ScanScreen key={result.page.session.id} page={result.page} />
      ) : (
        <SessionSummary page={result.page} today={colomboToday()} />
      )}
    </div>
  );
}
