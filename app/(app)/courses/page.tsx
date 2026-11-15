import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CourseManager } from "@/components/courses/course-manager";
import { loadCoursesPage } from "@/lib/class-courses";
import { t } from "@/lib/t";

export default function CoursesPage() {
  return (
    <Suspense fallback={<p className="text-slate">{t("Loading…")}</p>}>
      <CourseList />
    </Suspense>
  );
}

async function CourseList() {
  const page = await loadCoursesPage();
  if (page.status === "signed-out") {
    redirect("/sign-in");
  }
  if (page.status === "error") {
    return (
      <div>
        <h1>{t("Courses")}</h1>
        <p className="mt-2 max-w-md text-slate">
          {page.missing
            ? t(
                "Courses are not set up yet. Run the courses SQL in Supabase, then refresh.",
              )
            : t("Courses could not be loaded.")}
        </p>
      </div>
    );
  }

  return (
    <CourseManager
      courses={page.courses}
      teachers={page.teachers}
      canEdit={page.staff.role === "admin"}
    />
  );
}
