"use client";

import { useState } from "react";
import { DocumentUploadForm } from "@/components/students/documents";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
import type { DocumentKind } from "@/lib/document-kinds";
import { t } from "@/lib/t";

export function UploadDocumentButton({
  studentId,
  kinds,
  label,
}: {
  studentId: string;
  kinds: DocumentKind[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" className="h-11" onClick={() => setOpen(true)}>
        {label ?? t("Upload")}
      </Button>
      <FormDialog open={open} title={t("Upload a document")} onOpenChange={setOpen}>
        {open ? (
          <DocumentUploadForm
            studentId={studentId}
            kinds={kinds}
            onCancel={() => setOpen(false)}
            onDone={() => setOpen(false)}
          />
        ) : null}
      </FormDialog>
    </>
  );
}
