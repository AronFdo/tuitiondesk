"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CourseForm } from "@/components/courses/course-form";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, FormDialog } from "@/components/ui/form-dialog";
import { RowActions } from "@/components/ui/row-actions";
import { archiveCourse } from "@/lib/actions/courses";
import type { CourseListItem, TeacherOption } from "@/lib/class-courses";
import { formatDueDay } from "@/lib/dates";
import { formatLkr } from "@/lib/money";
import { t } from "@/lib/t";

export function CourseManager({
  courses,
  teachers,
  canEdit,
}: {
  courses: CourseListItem[];
  teachers: TeacherOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<CourseListItem | null>(null);
  const [deleting, setDeleting] = useState<CourseListItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const saving = useRef(false);
  async function confirmDelete() {
    if (!deleting || saving.current) {
      return;
    }
    saving.current = true;
    setDeleteError(null);
    setPending(true);
    const result = await archiveCourse({ courseId: deleting.id });
    saving.current = false;
    setPending(false);
    if (!result.ok) {
      setDeleteError(result.error);
      return;
    }
    setDeleting(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1>{t("Courses")}</h1>
        {canEdit ? (
          <div className="flex flex-wrap gap-3">
            <Button type="button" className="h-11" onClick={() => setAdding(true)}>
              {t("Add course")}
            </Button>
          </div>
        ) : null}
      </div>
      {courses.length === 0 ? (
        <p className="text-slate">{t("No courses yet.")}</p>
      ) : (
        <ul>
          {courses.map((course) => (
            <li key={course.id} className="flex items-center border-b border-line">
              <Link
                href={`/courses/${course.id}`}
                className={`row min-w-0 flex-1 justify-between gap-3${canEdit ? " mr-0!" : ""}`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-ink">{course.name}</span>
                  <span className="block truncate text-sm text-slate">{courseMeta(course)}</span>
                </span>
                <span className="shrink-0 text-sm text-slate">
                  {studentCount(course.studentCount)}
                </span>
              </Link>
              {canEdit ? (
                <RowActions
                  itemName={course.name}
                  onEdit={() => setEditing(course)}
                  onDelete={() => {
                    setDeleteError(null);
                    setDeleting(course);
                  }}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <FormDialog
        open={adding}
        title={t("Add a course")}
        onOpenChange={setAdding}
      >
        {adding ? (
          <CourseForm
            teachers={teachers}
            onCancel={() => setAdding(false)}
          />
        ) : null}
      </FormDialog>
      <FormDialog
        open={editing !== null}
        title={t("Edit course")}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
          }
        }}
      >
        {editing ? (
          <CourseForm
            key={editing.id}
            teachers={teachers}
            courseId={editing.id}
            defaults={editing.form}
            onDone={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        ) : null}
      </FormDialog>
      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? `${t("Delete")} ${deleting.name}?` : t("Delete course?")}
        confirmLabel={t("Delete course")}
        body={
          deleting
            ? `${deleting.name} ${t("will leave the list. Students stay in the class.")}`
            : ""
        }
        pending={pending}
        error={deleteError}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setDeleting(null);
          }
        }}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function courseMeta(course: CourseListItem) {
  return [
    course.level === course.name ? "" : course.level,
    course.scheduleText,
    course.monthlyFeeMinor > 0 ? formatLkr(course.monthlyFeeMinor) : "",
    course.tuitionDueDay
      ? `${t("Tuition due on the")} ${formatDueDay(course.tuitionDueDay)}`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function studentCount(count: number) {
  if (count === 0) {
    return t("No students");
  }
  if (count === 1) {
    return t("1 student");
  }
  return `${count} ${t("students")}`;
}
