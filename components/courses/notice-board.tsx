"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { TextAreaField, TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { cancelClassName, ConfirmDialog, FormDialog } from "@/components/ui/form-dialog";
import { archiveNotice, postNotice } from "@/lib/actions/notices";
import { colomboToday, formatDate } from "@/lib/dates";
import type { StaffNotice } from "@/lib/notices";
import { t } from "@/lib/t";
import { NOTICE_MAX_LENGTH } from "@/lib/validation/notices";

type NoticeFormValues = { body: string; showUntil: string };

// Notices parents see in the portal, for one course or (courseId null) the
// whole class.
export function NoticeBoard({
  courseId,
  canManage,
  notices,
}: {
  courseId: string | null;
  canManage: boolean;
  notices: StaffNotice[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<StaffNotice | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const saving = useRef(false);

  async function confirmRemove() {
    if (!removing || saving.current) {
      return;
    }
    saving.current = true;
    setRemoveError(null);
    setPending(true);
    const result = await archiveNotice({ noticeId: removing.id });
    saving.current = false;
    setPending(false);
    if (!result.ok) {
      setRemoveError(result.error);
      return;
    }
    setRemoving(null);
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <h2>{courseId ? t("Notices") : t("Notices to the whole class")}</h2>
        {canManage ? (
          <Button type="button" className="h-11" onClick={() => setAdding(true)}>
            {t("Post notice")}
          </Button>
        ) : null}
      </div>
      <p className="text-sm text-slate">
        {courseId
          ? t("Parents of students on this course see these in their portal.")
          : t("Every parent sees these in their portal.")}
      </p>
      {notices.length === 0 ? (
        <p className="mt-2 text-slate">{t("No notices yet.")}</p>
      ) : (
        <ul className="mt-2">
          {notices.map((notice) => (
            <li key={notice.id} className="flex items-start gap-3 border-b border-line py-3">
              <div className="min-w-0 flex-1">
                <p className={`whitespace-pre-line ${notice.ended ? "text-slate" : "text-ink"}`}>
                  {notice.body}
                </p>
                <p className="mt-1 text-sm text-slate">
                  {t("Posted")} {formatDate(notice.postedOn)}
                  {notice.showUntil
                    ? ` · ${notice.ended ? t("Ended") : t("Shown until")} ${formatDate(notice.showUntil)}`
                    : ""}
                </p>
              </div>
              {canManage ? (
                <button
                  type="button"
                  className="h-11 shrink-0 px-2 text-sm font-medium text-destructive"
                  onClick={() => {
                    setRemoveError(null);
                    setRemoving(notice);
                  }}
                >
                  {t("Remove")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <FormDialog open={adding} title={t("Post a notice")} onOpenChange={setAdding}>
        {adding ? (
          <NoticeForm
            courseId={courseId}
            onDone={() => {
              setAdding(false);
              router.refresh();
            }}
            onCancel={() => setAdding(false)}
          />
        ) : null}
      </FormDialog>
      <ConfirmDialog
        open={removing !== null}
        title={t("Remove this notice?")}
        body={t("Parents will no longer see it.")}
        pending={pending}
        error={removeError}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setRemoving(null);
          }
        }}
        onConfirm={() => void confirmRemove()}
      />
    </section>
  );
}

function NoticeForm({
  courseId,
  onDone,
  onCancel,
}: {
  courseId: string | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const saving = useRef(false);
  const form = useForm<NoticeFormValues>({ defaultValues: { body: "", showUntil: "" } });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        void form.handleSubmit(async (values) => {
          if (saving.current) {
            return;
          }
          saving.current = true;
          setError(null);
          setPending(true);
          const result = await postNotice({ courseId: courseId ?? "", ...values });
          saving.current = false;
          setPending(false);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          onDone();
        })(event);
      }}
    >
      <TextAreaField
        label={t("Notice")}
        maxLength={NOTICE_MAX_LENGTH}
        placeholder={t("No class this Saturday (Poya day).")}
        {...form.register("body")}
      />
      <TextField
        label={t("Show until (optional)")}
        type="date"
        min={colomboToday()}
        {...form.register("showUntil")}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-3">
        <button type="button" className={cancelClassName()} disabled={pending} onClick={onCancel}>
          {t("Cancel")}
        </button>
        <Button type="submit" className="h-11 flex-1" disabled={pending}>
          {pending ? t("Posting…") : t("Post")}
        </Button>
      </div>
    </form>
  );
}
