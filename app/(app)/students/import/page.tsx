import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { StudentImport } from "@/components/students/student-import";
import { colomboToday } from "@/lib/dates";
import { loadImportContext } from "@/lib/student-import-context";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/supabase/session";
import { t } from "@/lib/t";

export default function ImportStudentsPage() {
  return (
    <Suspense fallback={<p className="text-slate">{t("Loading…")}</p>}>
      <ImportScreen />
    </Suspense>
  );
}

async function ImportScreen() {
  const staff = await getStaff();
  if (!staff) {
    redirect("/sign-in");
  }
  const header = (
    <div>
      <Link href="/students" className="text-sm text-forest">
        {t("Students")}
      </Link>
      <h1 className="mt-1">{t("Import students")}</h1>
    </div>
  );
  if (staff.role !== "admin") {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <p className="text-slate">{t("Only the class owner can add students.")}</p>
      </div>
    );
  }

  const context = await loadImportContext(await createClient(), staff.institute.id);
  if (!context.ok) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <p className="text-slate">{t("Students could not be loaded. Refresh the page to try again.")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {header}
      <StudentImport courses={context.courses} existing={context.existing} today={colomboToday()} />
    </div>
  );
}
