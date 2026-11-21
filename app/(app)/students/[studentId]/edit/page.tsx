import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { StudentForm } from "@/components/students/student-form";
import { STUDENT_COLUMNS, studentInput, type StudentRow } from "@/lib/student-fields";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/supabase/session";
import { t } from "@/lib/t";
import { can } from "@/lib/permissions";

type Params = Promise<{ studentId: string }>;

export default function EditStudentPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<p className="text-slate">{t("Loading…")}</p>}>
      <EditStudent params={params} />
    </Suspense>
  );
}

async function EditStudent({ params }: { params: Params }) {
  const [{ studentId }, staff] = await Promise.all([params, getStaff()]);
  if (!staff) {
    redirect("/sign-in");
  }
  const back = `/students/${studentId}`;
  if (!can(staff, "students.manage")) {
    return <p className="text-slate">{t("Only the class owner can edit student details.")}</p>;
  }
  if (!/^[0-9a-f-]{36}$/i.test(studentId)) {
    return <p className="text-slate">{t("That student is not in this class.")}</p>;
  }
  const supabase = await createClient();
  const [{ data, error }, coursesResult, enrollmentsResult] = await Promise.all([
    supabase
      .from("students")
      .select(STUDENT_COLUMNS)
      .eq("id", studentId)
      .eq("institute_id", staff.institute.id)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("courses")
      .select("id, name")
      .eq("institute_id", staff.institute.id)
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("enrollments")
      .select("course_id")
      .eq("institute_id", staff.institute.id)
      .eq("student_id", studentId)
      .is("end_date", null),
  ]);
  if (error) {
    return (
      <p className="max-w-md text-slate">
        {error.code === "42703"
          ? t("Student details are not up to date. Run the SQL files in supabase/sql up to 030_student_start_date.sql in Supabase, then refresh.")
          : t("This student could not be loaded. Refresh the page to try again.")}
      </p>
    );
  }
  if (!data) {
    return <p className="text-slate">{t("That student is not in this class.")}</p>;
  }
  // Without both lists the course picker could end courses by mistake, so
  // it is left off and only the details are saved.
  const courses =
    coursesResult.error || enrollmentsResult.error ? undefined : (coursesResult.data ?? []);
  const currentCourseIds = (enrollmentsResult.data ?? []).map((row) => row.course_id);
  const row = data as unknown as StudentRow;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={back} className="text-sm text-forest">
          {row.full_name}
        </Link>
        <h1 className="mt-1">{t("Edit details")}</h1>
      </div>
      <StudentForm
        studentId={studentId}
        defaults={studentInput(row)}
        courses={courses}
        initialCourseIds={currentCourseIds}
        cancelHref={back}
      />
    </div>
  );
}
