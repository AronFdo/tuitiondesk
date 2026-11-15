"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CourseForm } from "@/components/courses/course-form";
import { ConfirmDialog, FormDialog } from "@/components/ui/form-dialog";
import { RowActions } from "@/components/ui/row-actions";
import { archiveCourse } from "@/lib/actions/courses";
import type { TeacherOption } from "@/lib/class-courses";
import { t } from "@/lib/t";
import type { CourseInput } from "@/lib/validation/course";

export function CourseEditor({
  courseId,
  courseName,
  form,
  teachers,
}: {
  courseId: string;
  courseName: string;
  form: CourseInput;
  teachers: TeacherOption[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const saving = useRef(false);

  async function confirmDelete() {
    if (saving.current) {
      return;
    }
    saving.current = true;
    setDeleteError(null);
    setPending(true);
    const result = await archiveCourse({ courseId });
    saving.current = false;
    setPending(false);
    if (!result.ok) {
      setDeleteError(result.error);
      return;
    }
    router.push("/courses");
    router.refresh();
  }

  return (
    <>
      <RowActions
        itemName={courseName}
        onEdit={() => setEditing(true)}
        onDelete={() => {
          setDeleteError(null);
          setDeleting(true);
        }}
      />
      <FormDialog
        open={editing}
        title={t("Edit course")}
        onOpenChange={setEditing}
      >
        {editing ? (
          <CourseForm
            teachers={teachers}
            courseId={courseId}
            defaults={form}
            onDone={() => setEditing(false)}
            onCancel={() => setEditing(false)}
          />
        ) : null}
      </FormDialog>
      <ConfirmDialog
        open={deleting}
        title={`${t("Delete")} ${courseName}?`}
        confirmLabel={t("Delete course")}
        body={`${courseName} ${t("will leave the list. Students stay in the class.")}`}
        pending={pending}
        error={deleteError}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setDeleting(false);
          }
        }}
        onConfirm={confirmDelete}
      />
    </>
  );
}
