import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { StudentForm } from "@/components/students/student-form";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/supabase/session";
import { t } from "@/lib/t";
import { can } from "@/lib/permissions";

type SearchParams = Promise<{ course?: string }>;

export default function NewStudentPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<p className="text-slate">{t("Loading…")}</p>}>
      <NewStudent searchParams={searchParams} />
    </Suspense>
  );
}

async function NewStudent({ searchParams }: { searchParams: SearchParams }) {
  const [{ course }, staff] = await Promise.all([searchParams, getStaff()]);
  if (!staff) {
    redirect("/sign-in");
  }
  const back = course ? `/courses/${course}` : "/students";
  const header = (
    <div>
      <Link href={back} className="text-sm text-forest">
        {course ? t("Back to the course") : t("Students")}
      </Link>
      <h1 className="mt-1">{t("Add a student")}</h1>
    </div>
  );
  if (!can(staff, "students.manage")) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <p className="text-slate">{t("Only the class owner can add students.")}</p>
      </div>
    );
  }
  const { data: courses } = await (await createClient())
    .from("courses")
    .select("id, name")
    .eq("institute_id", staff.institute.id)
    .is("archived_at", null)
    .order("name");
  const list = courses ?? [];

  return (
    <div className="flex flex-col gap-6">
      {header}
      <p className="max-w-xl text-slate">
        {t("Only first name, date of birth and gender are needed now. Fill in the rest when you have it.")}
      </p>
      <StudentForm
        courses={list}
        initialCourseIds={list.some((item) => item.id === course) ? [course as string] : []}
        cancelHref={back}
      />
    </div>
  );
}
