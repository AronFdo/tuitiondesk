import { Suspense } from "react";
import { redirect } from "next/navigation";
import { TuitionPanel } from "@/components/payments/tuition-panel";
import { colomboToday } from "@/lib/dates";
import { loadPaymentsPage } from "@/lib/payments";
import { t } from "@/lib/t";

type SearchParams = Promise<{ student?: string }>;

export default function PaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<p className="text-slate">{t("Loading…")}</p>}>
      <PaymentScreen searchParams={searchParams} />
    </Suspense>
  );
}

async function PaymentScreen({ searchParams }: { searchParams: SearchParams }) {
  const [{ student }, page] = await Promise.all([searchParams, loadPaymentsPage()]);
  if (page.status === "signed-out") {
    redirect("/sign-in");
  }
  if (page.status === "forbidden") {
    return (
      <div>
        <h1>{t("Payments")}</h1>
        <p className="mt-6 text-slate">{t("Only the class owner records payments.")}</p>
      </div>
    );
  }
  if (page.status === "error") {
    return (
      <div>
        <h1>{t("Payments")}</h1>
        <p className="mt-2 max-w-md text-slate">
          {page.missing
            ? t("Payments are not set up yet. Run the payments SQL in Supabase, then refresh.")
            : t("Payments could not be loaded. Refresh the page to try again.")}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1>{t("Payments")}</h1>
      <TuitionPanel
        key={student ?? "all"}
        payments={page.tuition}
        courses={page.courses}
        students={page.students}
        today={colomboToday()}
        preselectStudentId={student && /^[0-9a-f-]{36}$/i.test(student) ? student : null}
      />
    </div>
  );
}
