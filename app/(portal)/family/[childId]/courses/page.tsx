import { Suspense } from "react";
import { FileList } from "@/components/courses/file-list";
import { FamilyProblem } from "@/components/family/family-problem";
import { NoticeList } from "@/components/family/notice-list";
import { loadFamilyCourses } from "@/lib/family";
import { t } from "@/lib/t";

export default function FamilyCoursesPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-slate">{t("Loading…")}</p>}>
      <Courses params={params} />
    </Suspense>
  );
}

async function Courses({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const page = await loadFamilyCourses(childId);
  if (page.status !== "ready") {
    return <FamilyProblem problem={page} />;
  }
  return (
    <div className="flex flex-col gap-10">
      <h1>{t("Courses")}</h1>
      {page.courses.length === 0 ? (
        <p className="text-slate">{`${page.child.fullName} ${t("is not on a course yet.")}`}</p>
      ) : (
        page.courses.map((course) => (
          <section key={course.id} className="flex flex-col gap-6">
            <h2>{course.name}</h2>
            {course.notices.length > 0 ? (
              <div>
                <h3 className="text-base font-medium text-ink">{t("Notices")}</h3>
                <NoticeList notices={course.notices} empty="" showCourse={false} />
              </div>
            ) : null}
            <div>
              <h3 className="text-base font-medium text-ink">{t("Notes")}</h3>
              <FileList files={course.notes} empty={t("No notes yet.")} />
            </div>
            <div>
              <h3 className="text-base font-medium text-ink">{t("Worksheets")}</h3>
              <FileList files={course.worksheets} empty={t("No worksheets yet.")} />
            </div>
          </section>
        ))
      )}
    </div>
  );
}
