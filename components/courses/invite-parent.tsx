"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { cancelClassName, FormDialog } from "@/components/ui/form-dialog";
import { inviteParent } from "@/lib/actions/content";
import { t } from "@/lib/t";
import type { InviteParentInput } from "@/lib/validation/content";

export function InviteParentButton({ studentId }: { studentId: string }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  return (
    <>
      <button
        type="button"
        className="h-11 px-2 text-sm font-medium text-forest"
        onClick={() => {
          setSent(false);
          setOpen(true);
        }}
      >
        {t("Invite parent")}
      </button>
      <FormDialog open={open} title={t("Invite parent")} onOpenChange={setOpen}>
        {sent ? (
          <p className="text-slate">{t("Invite sent. They can open course notes and worksheets after they join.")}</p>
        ) : (
          <InviteParentForm
            studentId={studentId}
            onCancel={() => setOpen(false)}
            onDone={() => setSent(true)}
          />
        )}
      </FormDialog>
    </>
  );
}

function InviteParentForm({
  studentId,
  onDone,
  onCancel,
}: {
  studentId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const saving = useRef(false);
  const form = useForm<InviteParentInput>({
    defaultValues: { studentId, email: "" },
  });

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
          const result = await inviteParent({ ...values, studentId });
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
      <TextField label={t("Email")} type="email" {...form.register("email")} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-3">
        <button type="button" className={cancelClassName()} onClick={onCancel}>
          {t("Cancel")}
        </button>
        <Button type="submit" className="h-11 flex-1" disabled={pending}>
          {pending ? t("Sending…") : t("Send invite")}
        </Button>
      </div>
    </form>
  );
}
