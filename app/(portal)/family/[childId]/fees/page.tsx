import { Suspense } from "react";
import { FamilyProblem } from "@/components/family/family-problem";
import { formatDate, formatMonth } from "@/lib/dates";
import { loadFamilyFees } from "@/lib/family";
import { formatLkr } from "@/lib/money";
import { t } from "@/lib/t";

export default function FamilyFeesPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-slate">{t("Loading…")}</p>}>
      <Fees params={params} />
    </Suspense>
  );
}

async function Fees({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const page = await loadFamilyFees(childId);
  if (page.status !== "ready") {
    return <FamilyProblem problem={page} />;
  }

  return (
    <div className="flex flex-col gap-8">
      <h1>{t("Fees")}</h1>

      <section>
        <h2>{t("Tuition")}</h2>
        {page.tuition.length === 0 ? (
          <p className="mt-2 text-slate">{t("No monthly fee is set.")}</p>
        ) : (
          <ul className="mt-2">
            {page.tuition.map((course) => (
              <li key={course.courseId} className="flex flex-col gap-1 border-b border-line py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-ink">{course.courseName}</p>
                  {course.owed ? (
                    <p className="tabular shrink-0 font-medium text-ink">
                      {formatLkr(course.owed.amountMinor)}
                    </p>
                  ) : null}
                </div>
                {course.owed ? (
                  <p
                    className={`text-sm ${course.overdue ? "text-[var(--status-overdue-fg)]" : "text-slate"}`}
                  >
                    {course.owed.months.length === 1
                      ? formatMonth(course.owed.months[0])
                      : `${course.owed.months.length} ${t("months")} (${formatMonth(course.owed.months[0])} – ${formatMonth(course.owed.months[course.owed.months.length - 1])})`}{" "}
                    {course.overdue ? t("overdue since") : t("due on")} {formatDate(course.owed.dueOn)}
                  </p>
                ) : null}
                <p className="text-sm text-slate">
                  {formatLkr(course.monthlyFeeMinor)} {t("a month")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>{t("Payments")}</h2>
        {page.payments.length === 0 ? (
          <p className="mt-2 text-slate">{t("No payments yet.")}</p>
        ) : (
          <ul className="mt-2">
            {page.payments.map((payment) => (
              <li
                key={payment.id}
                className="flex items-start justify-between gap-3 border-b border-line py-3"
              >
                <div className="min-w-0">
                  <p className="text-ink">
                    {payment.periodMonth
                      ? `${t("Tuition for")} ${formatMonth(payment.periodMonth)}`
                      : t("Tuition")}
                  </p>
                  <p className="text-sm text-slate">
                    {payment.courseName} · {t("paid")} {formatDate(payment.paidOn)}
                  </p>
                </div>
                <p className="tabular shrink-0 text-ink">{formatLkr(payment.amountMinor)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
