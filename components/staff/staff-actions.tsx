"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { cancelClassName, ConfirmDialog, FormDialog } from "@/components/ui/form-dialog";
import { archiveStaffMember, giveStaffLogin, restoreStaffMember } from "@/lib/actions/staff";
import { t } from "@/lib/t";

const linkClassName =
  "press inline-flex h-11 items-center justify-center rounded-lg border border-line bg-surface px-4 text-sm font-medium text-forest";

export function StaffActions({
  member,
}: {
  member: {
    id: string;
    fullName: string;
    email: string | null;
    active: boolean;
    hasLogin: boolean;
    isSelf: boolean;
  };
}) {
  if (!member.active) {
    return <RestoreButton staffId={member.id} fullName={member.fullName} />;
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Link href={`/staff/${member.id}/edit`} className={linkClassName}>
        {t("Edit details")}
      </Link>
      {member.hasLogin ? null : <LoginButton staffId={member.id} email={member.email} />}
      {member.isSelf ? null : <ArchiveButton staffId={member.id} fullName={member.fullName} hasLogin={member.hasLogin} />}
    </div>
  );
}

function LoginButton({ staffId, email }: { staffId: string; email: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(email ?? "");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const saving = useRef(false);

  async function submit() {
    if (saving.current) {
      return;
    }
    saving.current = true;
    setError(null);
    setPending(true);
    const result = await giveStaffLogin({ staffId, email: value }).catch(() => null);
    saving.current = false;
    setPending(false);
    if (!result?.ok) {
      setError(result?.error ?? t("No connection. Nothing was saved. Try again when you are back online."));
      return;
    }
    setNotice(result.data);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        className="press inline-flex h-11 items-center justify-center rounded-lg bg-forest px-4 text-sm font-medium text-white"
        onClick={() => {
          setError(null);
          setNotice(null);
          setOpen(true);
        }}
      >
        {t("Give login access")}
      </button>
      <FormDialog open={open} title={t("Give login access")} onOpenChange={(next) => !pending && setOpen(next)}>
        {notice ? (
          <div className="flex flex-col gap-4">
            <p className="text-ink">{notice}</p>
            <Button type="button" className="h-11" onClick={() => setOpen(false)}>
              {t("Done")}
            </Button>
          </div>
        ) : (
          <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <p className="text-slate">
              {t("They sign in as a teacher: they can take attendance and post notices and files for the courses they teach. They cannot see fees.")}
            </p>
            <TextField
              id="staff-login-email"
              label={t("Email")}
              type="email"
              autoComplete="off"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <div className="flex gap-3">
              <button type="button" className={cancelClassName()} onClick={() => setOpen(false)} disabled={pending}>
                {t("Cancel")}
              </button>
              <Button type="submit" className="h-11 flex-1" disabled={pending}>
                {pending ? t("Sending…") : t("Send invite")}
              </Button>
            </div>
          </form>
        )}
      </FormDialog>
    </>
  );
}

function ArchiveButton({ staffId, fullName, hasLogin }: { staffId: string; fullName: string; hasLogin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);

  async function archive() {
    if (saving.current) {
      return;
    }
    saving.current = true;
    setPending(true);
    setError(null);
    const result = await archiveStaffMember({ staffId }).catch(() => null);
    saving.current = false;
    setPending(false);
    if (!result?.ok) {
      setError(result?.error ?? t("No connection. Nothing was saved. Try again when you are back online."));
      return;
    }
    setOpen(false);
    router.push("/staff");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        className="inline-flex h-11 items-center px-2 text-sm text-slate"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {t("No longer works here")}
      </button>
      <ConfirmDialog
        open={open}
        title={`${t("Archive")} ${fullName}?`}
        body={
          hasLogin
            ? t("They will no longer be able to sign in to this class, and the courses they teach will have no teacher until you choose one. Their details are kept under Former staff.")
            : t("Their details are kept under Former staff.")
        }
        pending={pending}
        error={error}
        confirmLabel={t("Archive")}
        pendingLabel={t("Archiving…")}
        onOpenChange={(next) => {
          if (!next && !pending) {
            setOpen(false);
          }
        }}
        onConfirm={() => void archive()}
      />
    </>
  );
}

function RestoreButton({ staffId, fullName }: { staffId: string; fullName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);

  async function restore() {
    if (saving.current) {
      return;
    }
    saving.current = true;
    setPending(true);
    setError(null);
    const result = await restoreStaffMember({ staffId }).catch(() => null);
    saving.current = false;
    setPending(false);
    if (!result?.ok) {
      setError(result?.error ?? t("No connection. Nothing was saved. Try again when you are back online."));
      return;
    }
    setOpen(false);
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
        {t("Restore")}
      </button>
      <ConfirmDialog
        open={open}
        title={`${t("Restore")} ${fullName}?`}
        body={t("They go back on the staff list. Give them login access again if they need to sign in.")}
        pending={pending}
        error={error}
        tone="primary"
        confirmLabel={t("Restore")}
        pendingLabel={t("Saving…")}
        onOpenChange={(next) => {
          if (!next && !pending) {
            setOpen(false);
          }
        }}
        onConfirm={() => void restore()}
      />
    </>
  );
}
