"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { SelectField, TextAreaField, TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { cancelClassName, ConfirmDialog, FormDialog } from "@/components/ui/form-dialog";
import { markStudentLeft, rejoinStudent, reissueStudentCard } from "@/lib/actions/students";
import { LEAVE_REASONS } from "@/lib/course-history";
import { colomboToday } from "@/lib/dates";
import { t } from "@/lib/t";

const linkClassName =
  "press inline-flex h-11 items-center justify-center rounded-lg border border-line bg-surface px-4 text-sm font-medium text-forest";

export function StudentActions({
  student,
  canEdit,
  canRejoin = false,
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
  canRejoin?: boolean;
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
      {canRejoin ? <RejoinButton studentId={student.id} fullName={student.fullName} /> : null}
      <a href={`/cards?student=${student.id}`} target="_blank" rel="noopener" className={linkClassName}>
        {t("Print card")}
      </a>
      {/* A plain link: the route sends the file with the student's name, which
          works in every browser, Safari included. */}
      <a href={`/students/${student.id}/qr`} download className={linkClassName}>
        {t("Download QR")}
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
          <LeaveButton studentId={student.id} fullName={student.fullName} />
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

type LeaveValues = { leftOn: string; reason: string; note: string };

function LeaveButton({ studentId, fullName }: { studentId: string; fullName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="inline-flex h-11 items-center px-2 text-sm text-slate"
        onClick={() => setOpen(true)}
      >
        {t("Left the institute")}
      </button>
      <FormDialog open={open} title={`${fullName} ${t("left the institute")}`} onOpenChange={setOpen}>
        <LeaveForm studentId={studentId} onClose={() => setOpen(false)} />
      </FormDialog>
    </>
  );
}

function LeaveForm({ studentId, onClose }: { studentId: string; onClose: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const saving = useRef(false);
  const today = colomboToday();
  const form = useForm<LeaveValues>({ defaultValues: { leftOn: today, reason: "", note: "" } });

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(event) => {
        void form.handleSubmit(async (values) => {
          if (saving.current) {
            return;
          }
          saving.current = true;
          setError(null);
          setPending(true);
          const result = await markStudentLeft({ studentId, ...values }).catch(() => null);
          saving.current = false;
          setPending(false);
          if (!result?.ok) {
            setError(result?.error ?? t("No connection. Nothing was saved. Try again when you are back online."));
            return;
          }
          onClose();
          router.refresh();
        })(event);
      }}
    >
      <p className="text-slate">
        {t("Their courses end on this day and they come off the class lists. Their record, payments and history stay, and they can rejoin later.")}
      </p>
      <TextField
        label={t("Last day")}
        type="date"
        max={today}
        required
        id="leave-left-on"
        {...form.register("leftOn")}
      />
      <SelectField label={t("Reason")} id="leave-reason" {...form.register("reason")}>
        <option value="">{t("Not given")}</option>
        {LEAVE_REASONS.map((reason) => (
          <option key={reason.value} value={reason.value}>
            {t(reason.label)}
          </option>
        ))}
      </SelectField>
      <TextAreaField label={t("Note")} id="leave-note" maxLength={500} {...form.register("note")} />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex gap-3">
        <button type="button" className={cancelClassName()} onClick={onClose} disabled={pending}>
          {t("Cancel")}
        </button>
        <Button type="submit" className="h-11 flex-1" disabled={pending}>
          {pending ? t("Saving…") : t("Mark as left")}
        </Button>
      </div>
    </form>
  );
}

function RejoinButton({ studentId, fullName }: { studentId: string; fullName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);

  async function rejoin() {
    if (saving.current) {
      return;
    }
    saving.current = true;
    setPending(true);
    setError(null);
    const result = await rejoinStudent({ studentId }).catch(() => null);
    saving.current = false;
    setPending(false);
    if (!result?.ok) {
      setError(result?.error ?? t("No connection. Nothing was saved. Try again when you are back online."));
      return;
    }
    setOpen(false);
    router.push(`/students/${studentId}/edit`);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        className="press inline-flex h-11 items-center justify-center rounded-lg bg-forest px-4 text-sm font-medium text-white"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {t("Rejoin")}
      </button>
      <ConfirmDialog
        open={open}
        title={`${t("Bring")} ${fullName} ${t("back?")}`}
        body={t("They go back on the class lists. Choose their courses on the next page; their old courses stay in their history.")}
        pending={pending}
        error={error}
        tone="primary"
        confirmLabel={t("Rejoin")}
        pendingLabel={t("Saving…")}
        onOpenChange={(next) => {
          if (!next && !pending) {
            setOpen(false);
          }
        }}
        onConfirm={() => void rejoin()}
      />
    </>
  );
}
