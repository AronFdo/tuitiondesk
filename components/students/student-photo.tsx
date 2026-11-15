"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StudentAvatar } from "@/components/students/student-avatar";
import { ConfirmDialog } from "@/components/ui/form-dialog";
import { removeStudentPhoto, uploadStudentPhoto } from "@/lib/actions/students";
import { squarePhoto } from "@/lib/photo-resize";
import { t } from "@/lib/t";

export function StudentPhoto({
  studentId,
  name,
  photoUrl,
  canEdit,
}: {
  studentId: string;
  name: string;
  photoUrl: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  async function choose(file: File | undefined) {
    if (!file || pending) {
      return;
    }
    setError(null);
    setPending(true);
    let photo: Blob;
    try {
      photo = await squarePhoto(file);
    } catch {
      setPending(false);
      setError(t("That photo could not be read. Use a JPEG or PNG."));
      return;
    }
    const formData = new FormData();
    formData.set("studentId", studentId);
    formData.set("photo", new File([photo], "photo.jpg", { type: "image/jpeg" }));
    const result = await uploadStudentPhoto(formData);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  // The photo is deleted from storage, so this asks first.
  async function remove() {
    if (pending) {
      return;
    }
    setRemoveError(null);
    setPending(true);
    const result = await removeStudentPhoto({ studentId }).catch(() => null);
    setPending(false);
    if (!result?.ok) {
      setRemoveError(result?.error ?? t("That photo could not be removed. Check your connection and try again."));
      return;
    }
    setConfirming(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={pending ? "opacity-50" : undefined}>
        <StudentAvatar name={name} photoUrl={photoUrl} size="lg" />
      </div>
      {canEdit ? (
        <>
          <input
            ref={input}
            type="file"
            accept="image/*"
            // Opens the front camera on a phone; a computer shows the file picker.
            capture="user"
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => {
              void choose(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="h-9 px-2 text-sm font-medium text-forest disabled:opacity-50"
              disabled={pending}
              onClick={() => input.current?.click()}
            >
              {pending ? t("Saving…") : photoUrl ? t("Change photo") : t("Add photo")}
            </button>
            {photoUrl && !pending ? (
              <button
                type="button"
                className="h-9 px-2 text-sm text-slate"
                onClick={() => {
                  setRemoveError(null);
                  setConfirming(true);
                }}
              >
                {t("Remove photo")}
              </button>
            ) : null}
          </div>
        </>
      ) : null}
      {error ? (
        <p role="alert" className="max-w-48 text-center text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {canEdit ? (
        <ConfirmDialog
          open={confirming}
          title={`${t("Remove")} ${name}${t("'s photo?")}`}
          body={t("The photo is deleted. Their card will show initials until you add a new one.")}
          pending={pending}
          error={removeError}
          confirmLabel={t("Remove photo")}
          pendingLabel={t("Removing…")}
          onOpenChange={(open) => {
            if (!open && !pending) {
              setConfirming(false);
            }
          }}
          onConfirm={() => void remove()}
        />
      ) : null}
    </div>
  );
}
