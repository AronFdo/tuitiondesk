import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CourseContent } from "@/components/courses/course-content";
import { CourseEditor } from "@/components/courses/course-editor";
import { NoticeSection } from "@/components/courses/notice-section";
import { StudentManager } from "@/components/courses/student-manager";
import { loadCourse } from "@/lib/course-detail";
import { formatDueDay } from "@/lib/dates";
import { formatLkr } from "@/lib/money";
import { t } from "@/lib/t";
import { can } from "@/lib/permissions";

export default function CoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-slate">{t("Loading…")}</p>}>
      <CourseDetail params={params} />
    </Suspense>
  );
}

async function CourseDetail({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const page = await loadCourse(courseId);
  if (page.status === "signed-out") {
    redirect("/sign-in");
  }
  if (page.status === "error") {
    return (
      <p className="max-w-md text-slate">
        {page.missing
          ? t(
              "Courses are not set up yet. Run the courses SQL in Supabase, then refresh.",
            )
          : t("This course could not be loaded.")}
      </p>
    );
  }
  if (page.status === "missing") {
    return (
      <div>
        <p className="text-slate">{t("That course is not in this class.")}</p>
        <Link href="/courses" className="mt-4 inline-flex h-11 items-center text-forest">
          {t("All courses")}
        </Link>
      </div>
    );
  }

  const { course } = page;
  const meta = [
    course.level === course.name ? "" : course.level,
    course.scheduleText,
    course.monthlyFeeMinor > 0 ? formatLkr(course.monthlyFeeMinor) : "",
    course.tuitionDueDay
      ? `${t("Tuition due on the")} ${formatDueDay(course.tuitionDueDay)}`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const canEdit = can(page.staff, "courses.manage");

  return (
    <div className="flex flex-col gap-10">
      <div>
        <Link href="/courses" className="text-sm text-forest">
          {t("All courses")}
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <h1 className="min-w-0">{course.name}</h1>
          {canEdit ? (
            <CourseEditor
              courseId={course.id}
              courseName={course.name}
              form={course.form}
              teachers={page.teachers}
            />
          ) : null}
        </div>
        {meta ? <p className="mt-2 text-slate">{meta}</p> : null}
        {course.description ? (
          <p className="mt-2 max-w-xl text-ink">{course.description}</p>
        ) : null}
      </div>

      <StudentManager
        courseId={course.id}
        canEdit={canEdit}
        heading={t("Students")}
        empty={t("No students in this course yet.")}
        students={page.students}
      />
      <Suspense fallback={null}>
        <NoticeSection
          courseId={course.id}
          canManage={canEdit || course.form.teacherProfileId === page.staff.userId}
        />
      </Suspense>
      {page.filesReady ? (
        <CourseContent
          courseId={course.id}
          canManage={canEdit || course.form.teacherProfileId === page.staff.userId}
          notes={page.notes}
          worksheets={page.worksheets}
        />
      ) : null}
    </div>
  );
}
