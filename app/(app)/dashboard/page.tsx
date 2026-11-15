import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { NoticeSection } from "@/components/courses/notice-section";
import { loadDashboard, type ClassSummary } from "@/lib/dashboard";
import { formatMonth } from "@/lib/dates";
import { formatLkr } from "@/lib/money";
import { t } from "@/lib/t";
import { can } from "@/lib/permissions";

export default function DashboardPage() {
  return (
    <Suspense fallback={<p className="text-slate">{t("Loading…")}</p>}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const page = await loadDashboard();
  if (page.status === "signed-out") {
    redirect("/sign-in");
  }

  const staff = page.status === "ready" ? page.summary.staff : page.staff;
  const greeting = staff.fullName
    ? `${t("Hello")}, ${staff.fullName}`
    : staff.institute.name;
  const summary = page.status === "ready" ? page.summary : null;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="display">{greeting}</h1>

      {page.status === "missing" ? (
        <p className="max-w-md text-slate">
          {t(
            "Courses are not set up yet. Run the courses SQL in Supabase, then refresh.",
          )}
        </p>
      ) : null}
      {page.status === "error" ? (
        <p className="text-slate">
          {t("The class summary could not be loaded.")}{" "}
          {/* Plain anchor so the server data is fetched again. */}
          <a href="/dashboard" className="text-forest underline underline-offset-4">
            {t("Try again")}
          </a>
        </p>
      ) : null}

      <section className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
        <Figure
          href="/students"
          value={summary ? String(summary.students) : "—"}
          label={t("Active students")}
        />
        <TodayFigure today={summary?.today ?? null} />
        {can(staff, "fees.view") ? (
          <Figure
            href="/payments"
            value={moneyOrDash(summary?.overdueMinor)}
            label={t("Overdue")}
            tone={summary?.overdueMinor ? "overdue" : undefined}
          />
        ) : null}
        {can(staff, "fees.view") ? (
          <Figure
            href="/payments"
            value={moneyOrDash(summary?.collectedThisMonthMinor)}
            label={t("Collected this month")}
          />
        ) : null}
      </section>

      {summary && can(staff, "fees.view") ? <Breakdown summary={summary} /> : null}
      {summary ? <Attention summary={summary} /> : null}
      {can(staff, "notices.class") ? (
        <Suspense fallback={null}>
          <NoticeSection courseId={null} canManage />
        </Suspense>
      ) : null}
    </div>
  );
}

function moneyOrDash(minor: number | null | undefined) {
  return minor == null ? "—" : formatLkr(minor);
}

function TodayFigure({ today }: { today: ClassSummary["today"] }) {
  if (!today) {
    return <Figure href="/attendance" value="—" label={t("Here today")} />;
  }
  return (
    <Figure
      href="/attendance"
      value={String(today.present)}
      label={t("Here today")}
      detail={
        today.sessions === 0
          ? t("No attendance taken yet")
          : today.sessions === 1
            ? t("1 class")
            : `${today.sessions} ${t("classes")}`
      }
    />
  );
}

function Figure({
  href,
  value,
  label,
  detail,
  tone,
}: {
  href: string;
  value: string;
  label: string;
  detail?: string;
  tone?: "overdue";
}) {
  return (
    <Link href={href} className="figure-link pressable block min-h-11 min-w-0">
      <p className={tone === "overdue" ? "figure text-[var(--status-overdue-fg)]" : "figure"}>
        {value}
      </p>
      <p className="figure-label mt-1 truncate text-slate">{label}</p>
      {detail ? <p className="figure-label text-slate">{detail}</p> : null}
    </Link>
  );
}

function Breakdown({ summary }: { summary: ClassSummary }) {
  const rows = [
    { href: "/courses", label: t("Courses"), value: String(summary.courses) },
    {
      href: "/payments",
      label: `${t("Fees still due for")} ${formatMonth(summary.expectedMonth)}`,
      value: moneyOrDash(summary.expectedFeesMinor),
    },
    {
      href: "/students",
      label: t("Not in a course"),
      value: String(summary.withoutCourse),
    },
  ];

  return (
    <section>
      <h2>{t("Class summary")}</h2>
      <ul className="mt-2">
        {rows.map((row) => (
          <li key={row.label} className="border-b border-line">
            <Link href={row.href} className="row pressable gap-3">
              <span className="flex-1">{row.label}</span>
              <span className="tabular text-forest">{row.value}</span>
              <ChevronRight aria-hidden className="size-4 shrink-0 text-slate" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Attention({ summary }: { summary: ClassSummary }) {
  const items: { href: string; label: string }[] = [];
  if (summary.courses === 0) {
    items.push({
      href: "/courses",
      label: t("No courses yet. Add a course, then add students to it."),
    });
  }
  if (summary.withoutCourse === 1) {
    items.push({
      href: "/students",
      label: t("1 student is not in a course."),
    });
  } else if (summary.withoutCourse > 1) {
    items.push({
      href: "/students",
      label: `${summary.withoutCourse} ${t("students are not in a course.")}`,
    });
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <section>
      <h2>{t("Needs attention")}</h2>
      <ul className="mt-2">
        {items.map((item) => (
          <li key={item.label} className="border-b border-line">
            <Link href={item.href} className="row pressable gap-3">
              <span className="flex-1">{item.label}</span>
              <ChevronRight aria-hidden className="size-4 shrink-0 text-slate" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
