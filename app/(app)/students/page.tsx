import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { StudentManager } from "@/components/courses/student-manager";
import { loadStudentsPage } from "@/lib/students";
import { t } from "@/lib/t";

export default function StudentsPage() {
  return (
    <Suspense fallback={<p className="text-slate">{t("Loading…")}</p>}>
      <StudentList />
    </Suspense>
  );
}

async function StudentList() {
  const page = await loadStudentsPage();
  if (page.status === "signed-out") {
    redirect("/sign-in");
  }
  if (page.status === "error") {
    return (
      <div>
        <h1>{t("Students")}</h1>
        <p className="mt-2 max-w-md text-slate">
          {page.missing
            ? t(
                "Courses are not set up yet. Run the courses SQL in Supabase, then refresh.",
              )
            : t("Students could not be loaded. Refresh the page to try again.")}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1>{t("Students")}</h1>
          <p className="text-sm text-slate">
            {page.students.length === 1 ? t("1 student") : `${page.students.length} ${t("students")}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {page.students.length > 0 ? (
            <a
              href="/cards"
              target="_blank"
              rel="noopener"
              className="press inline-flex h-11 items-center justify-center rounded-lg border border-line bg-surface px-4 text-sm font-medium text-forest"
            >
              {t("Print cards")}
            </a>
          ) : null}
          {page.canEdit ? (
            <>
              <Link
                href="/students/import"
                className="press inline-flex h-11 items-center justify-center rounded-lg border border-line bg-surface px-4 text-sm font-medium text-forest"
              >
                {t("Import students")}
              </Link>
              <Link
                href="/students/new"
                className="press inline-flex h-11 items-center justify-center rounded-lg bg-forest px-4 text-sm font-medium text-white"
              >
                {t("Add student")}
              </Link>
            </>
          ) : null}
        </div>
      </div>
      <StudentManager
        canEdit={page.canEdit}
        searchable
        empty={
          page.canEdit
            ? t("No students yet. Add one, or import a list from a spreadsheet.")
            : t("No students yet.")
        }
        students={page.students}
      />
    </div>
  );
}
