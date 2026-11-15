"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, FormDialog } from "@/components/ui/form-dialog";
import { deleteCourseFile, uploadCourseFile } from "@/lib/actions/content";
import { t } from "@/lib/t";
import type { CourseFileKind } from "@/lib/validation/content";
import { FileList } from "@/components/courses/file-list";

export type CourseContentFile = {
  id: string;
  name: string;
  sizeBytes: number;
};

export function CourseContent({
  courseId,
  canManage,
  notes,
  worksheets,
}: {
  courseId: string;
  canManage: boolean;
  notes: CourseContentFile[];
  worksheets: CourseContentFile[];
}) {
  return (
    <section className="flex flex-col gap-8">
      <h2>{t("Course content")}</h2>
      <FileGroup
        courseId={courseId}
        kind="note"
        title={t("Notes")}
        empty={t("No notes yet.")}
        addLabel={t("Add note")}
        canManage={canManage}
        files={notes}
      />
      <FileGroup
        courseId={courseId}
        kind="worksheet"
        title={t("Worksheets")}
        empty={t("No worksheets yet.")}
        addLabel={t("Add worksheet")}
        canManage={canManage}
        files={worksheets}
      />
    </section>
  );
}

function FileGroup({
  courseId,
  kind,
  title,
  empty,
  addLabel,
  canManage,
  files,
}: {
  courseId: string;
  kind: CourseFileKind;
  title: string;
  empty: string;
  addLabel: string;
  canManage: boolean;
  files: CourseContentFile[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<CourseContentFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const saving = useRef(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current) {
      return;
    }
    saving.current = true;
    setError(null);
    setPending(true);
    const formData = new FormData(event.currentTarget);
    formData.set("courseId", courseId);
    formData.set("kind", kind);
    const result = await uploadCourseFile(formData);
    saving.current = false;
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setAdding(false);
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleting || saving.current) {
      return;
    }
    saving.current = true;
    setDeleteError(null);
    setPending(true);
    const result = await deleteCourseFile({ fileId: deleting.id });
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
    <div>
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-base font-medium text-ink">{title}</h3>
        {canManage ? (
          <Button type="button" className="h-11" onClick={() => setAdding(true)}>
            {addLabel}
          </Button>
        ) : null}
      </div>
      <FileList
        files={files}
        empty={empty}
        canDelete={canManage}
        onDelete={(file) => {
          setDeleteError(null);
          setDeleting(file);
        }}
      />
      <FormDialog open={adding} title={addLabel} onOpenChange={setAdding}>
        <form className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)}>
          <label className="flex flex-col gap-2 text-sm font-medium text-ink">
            {t("File")}
            <input
              name="file"
              type="file"
              required
              accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.ppt,.pptx"
              className="h-11 text-sm font-normal text-ink file:mr-3 file:h-11 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-forest"
            />
          </label>
          <p className="text-sm text-slate">{t("PDF, image, Word, or PowerPoint. Up to 25 MB.")}</p>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="h-11" disabled={pending}>
            {pending ? t("Saving…") : t("Save")}
          </Button>
        </form>
      </FormDialog>
      <ConfirmDialog
        open={deleting !== null}
        title={t("Delete this file?")}
        body={t("It will leave this course. Parents will no longer see it.")}
        pending={pending}
        error={deleteError}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
          }
        }}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
