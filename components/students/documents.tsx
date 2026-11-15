"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SelectField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { cancelClassName, ConfirmDialog } from "@/components/ui/form-dialog";
import {
  deleteStudentDocument,
  openStudentDocument,
  uploadStudentDocument,
} from "@/lib/actions/documents";
import { documentLabel, type DocumentKind, type StudentDocument } from "@/lib/document-kinds";
import { t } from "@/lib/t";

export function DocumentList({
  documents,
  empty,
}: {
  documents: StudentDocument[];
  empty: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<StudentDocument | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function openDocument(documentId: string) {
    setError(null);
    const result = await openStudentDocument({ documentId });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    window.open(result.data.url, "_blank", "noopener,noreferrer");
  }

  async function confirmDelete() {
    if (!deleting || pending) {
      return;
    }
    setDeleteError(null);
    setPending(true);
    const result = await deleteStudentDocument({ documentId: deleting.id });
    setPending(false);
    if (!result.ok) {
      setDeleteError(result.error);
      return;
    }
    setDeleting(null);
    router.refresh();
  }

  if (documents.length === 0) {
    return <p className="mt-2 text-slate">{empty}</p>;
  }

  return (
    <div>
      <ul className="mt-2">
        {documents.map((document) => (
          <li key={document.id} className="flex items-center border-b border-line">
            <button
              type="button"
              className="row min-w-0 flex-1 justify-between gap-3 text-left"
              onClick={() => void openDocument(document.id)}
            >
              <span className="min-w-0 break-words text-ink">{documentLabel(document.kind)}</span>
              <span className="min-w-0 break-all text-end text-sm text-slate">{document.fileName}</span>
            </button>
            <button
              type="button"
              className="h-11 px-2 text-sm font-medium text-destructive"
              onClick={() => {
                setDeleteError(null);
                setDeleting(document);
              }}
            >
              {t("Delete")}
            </button>
          </li>
        ))}
      </ul>
      {error ? <p role="alert" className="mt-2 text-sm text-destructive">{error}</p> : null}
      <ConfirmDialog
        open={deleting !== null}
        title={deleting ? `${t("Delete")} ${documentLabel(deleting.kind)}?` : t("Delete document?")}
        confirmLabel={t("Delete document")}
        body={deleting ? `${documentLabel(deleting.kind)} · ${deleting.fileName}` : ""}
        pending={pending}
        error={deleteError}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setDeleting(null);
          }
        }}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

export function DocumentUploadForm({
  studentId,
  kinds,
  defaultKind,
  onDone,
  onCancel,
}: {
  studentId: string;
  kinds: DocumentKind[];
  defaultKind?: DocumentKind;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const saving = useRef(false);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (saving.current) {
          return;
        }
        const formData = new FormData(event.currentTarget);
        saving.current = true;
        setError(null);
        setPending(true);
        void uploadStudentDocument(formData).then((result) => {
          saving.current = false;
          setPending(false);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          onDone?.();
          router.refresh();
        });
      }}
    >
      <input type="hidden" name="studentId" value={studentId} />
      <SelectField label={t("Document")} name="kind" defaultValue={defaultKind ?? kinds[0]}>
        {kinds.map((kind) => (
          <option key={kind} value={kind}>
            {documentLabel(kind)}
          </option>
        ))}
      </SelectField>
      <div className="flex flex-col gap-2">
        <label htmlFor="document-file" className="text-sm font-medium text-ink">
          {t("File or photo")}
        </label>
        <input
          id="document-file"
          name="file"
          type="file"
          required
          accept="image/*,application/pdf,.heic,.heif"
          className="text-sm text-ink file:mr-3 file:h-11 file:rounded-md file:border file:border-line file:bg-surface file:px-3 file:text-forest"
        />
        <p className="text-sm text-slate">{t("PDF or photo, up to 10 MB.")}</p>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-3">
        {onCancel ? (
          <button type="button" className={cancelClassName()} disabled={pending} onClick={onCancel}>
            {t("Cancel")}
          </button>
        ) : null}
        <Button type="submit" className="h-11 flex-1" disabled={pending}>
          {pending ? t("Uploading…") : t("Upload")}
        </Button>
      </div>
    </form>
  );
}
