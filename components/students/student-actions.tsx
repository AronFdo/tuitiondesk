"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ConfirmDialog } from "@/components/ui/form-dialog";
import { reissueStudentCard } from "@/lib/actions/students";
import { t } from "@/lib/t";

const linkClassName =
  "press inline-flex h-11 items-center justify-center rounded-lg border border-line bg-surface px-4 text-sm font-medium text-forest";

export function StudentActions({
  student,
  canEdit,
}: {
  student: {
    id: string;
    fullName: string;
    dateOfBirth: string | null;
    gender: string | null;
    guardianName: string | null;
    guardianPhone: string | null;
  };
  canEdit: boolean;
}) {
  const router = useRouter();
  const [reissuing, setReissuing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);

  async function reissue() {
    if (saving.current) {
      return;
    }
    saving.current = true;
    setPending(true);
    setError(null);
    const result = await reissueStudentCard({ studentId: student.id });
    saving.current = false;
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setReissuing(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <a href={`/cards?student=${student.id}`} target="_blank" rel="noopener" className={linkClassName}>
        {t("Print card")}
      </a>
      {canEdit ? (
        <>
          <Link href={`/students/${student.id}/edit`} className={linkClassName}>
            {t("Edit details")}
          </Link>
          <button
            type="button"
            className="inline-flex h-11 items-center px-2 text-sm text-slate"
            onClick={() => {
              setError(null);
              setReissuing(true);
            }}
          >
            {t("New card")}
          </button>
          <ConfirmDialog
            open={reissuing}
            title={t("Make a new card?")}
            body={t(
              "The QR code on the old card will stop working. Use this when a card is lost or someone else has it.",
            )}
            pending={pending}
            error={error}
            tone="primary"
            confirmLabel={t("Make new card")}
            pendingLabel={t("Making…")}
            onOpenChange={(open) => {
              if (!open && !pending) {
                setReissuing(false);
              }
            }}
            onConfirm={() => void reissue()}
          />
        </>
      ) : null}
    </div>
  );
}
