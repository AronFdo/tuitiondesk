"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TextField } from "@/components/form/text-field";
import { Button } from "@/components/ui/button";
import { cancelClassName, ConfirmDialog, FormDialog } from "@/components/ui/form-dialog";
import { archiveStaffMember, giveStaffLogin, restoreStaffMember, setStaffRole } from "@/lib/actions/staff";
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
    login: "admin" | "teacher" | null;
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
      {member.login ? null : <LoginButton staffId={member.id} email={member.email} />}
      {member.login && !member.isSelf ? (
        <RoleButton staffId={member.id} fullName={member.fullName} login={member.login} />
      ) : null}
      {member.isSelf ? null : (
        <ArchiveButton staffId={member.id} fullName={member.fullName} hasLogin={member.login !== null} />
      )}
    </div>
  );
}

function LoginButton({ staffId, email }: { staffId: string; email: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(email ?? "");
  const [role, setRole] = useState<"teacher" | "admin">("teacher");
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
    const result = await giveStaffLogin({ staffId, email: value, role }).catch(() => null);
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
            <fieldset>
              <legend className="text-sm font-medium text-ink">{t("They sign in as")}</legend>
              {(
                [
                  {
                    value: "teacher",
                    label: t("Teacher"),
                    hint: t("Takes attendance and posts notices and files for the courses they teach. Cannot see fees."),
                  },
                  {
                    value: "admin",
                    label: t("Admin"),
                    hint: t("Can do everything you can: fees, students, staff, settings, and adding other admins."),
                  },
                ] as const
              ).map((option) => (
                <label key={option.value} className="mt-2 flex items-start gap-3 py-1">
                  <input
                    type="radio"
                    name="staff-login-role"
                    value={option.value}
                    checked={role === option.value}
                    onChange={() => setRole(option.value)}
                    className="mt-1 size-5 accent-forest"
                  />
                  <span>
                    <span className="block text-ink">{option.label}</span>
                    <span className="block text-sm text-slate">{option.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
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

function RoleButton({
  staffId,
  fullName,
  login,
}: {
  staffId: string;
  fullName: string;
  login: "admin" | "teacher";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const next = login === "admin" ? "teacher" : "admin";

  async function change() {
    if (saving.current) {
      return;
    }
    saving.current = true;
    setPending(true);
    setError(null);
    const result = await setStaffRole({ staffId, role: next }).catch(() => null);
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
        className={linkClassName}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {next === "admin" ? t("Make admin") : t("Make teacher")}
      </button>
      <ConfirmDialog
        open={open}
        title={next === "admin" ? `${t("Make")} ${fullName} ${t("an admin?")}` : `${t("Make")} ${fullName} ${t("a teacher?")}`}
        body={
          next === "admin"
            ? t("They will be able to do everything you can: see and record fees, edit students, manage staff, change settings, and add or remove other admins.")
            : t("They keep their login and courses, but can no longer see fees, edit students, manage staff or change settings.")
        }
        pending={pending}
        error={error}
        tone={next === "admin" ? "primary" : "danger"}
        confirmLabel={next === "admin" ? t("Make admin") : t("Make teacher")}
        pendingLabel={t("Saving…")}
        onOpenChange={(value) => {
          if (!value && !pending) {
            setOpen(false);
          }
        }}
        onConfirm={() => void change()}
      />
    </>
  );
}
