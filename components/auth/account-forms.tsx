"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FormError, SubmitButton } from "@/components/auth/form-bits";
import { TextField } from "@/components/form/text-field";
import {
  acceptInvite,
  requestPasswordReset,
  updatePassword,
} from "@/lib/actions/password";
import { t } from "@/lib/t";
import type {
  AcceptInviteInput,
  EmailInput,
  PasswordInput,
} from "@/lib/validation/auth";

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const form = useForm<EmailInput>({ defaultValues: { email: "" } });

  async function onSubmit(values: EmailInput) {
    setError(null);
    setNotice(null);
    setPending(true);
    const result = await requestPasswordReset(values);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotice(t("If that email has an account, a reset link is on its way."));
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
      <TextField label={t("Email")} type="email" autoComplete="email" {...form.register("email")} />
      <FormError message={error} />
      {notice ? <p className="text-sm text-slate">{notice}</p> : null}
      <SubmitButton label={t("Send reset link")} pending={pending} />
      <Link href="/sign-in" className="text-sm text-forest underline-offset-4 hover:underline">
        {t("Sign in")}
      </Link>
    </form>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const form = useForm<PasswordInput>({ defaultValues: { password: "" } });

  async function onSubmit(values: PasswordInput) {
    setError(null);
    setPending(true);
    const result = await updatePassword(values);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
      <TextField
        label={t("New password")}
        type="password"
        autoComplete="new-password"
        {...form.register("password")}
      />
      <FormError message={error} />
      <SubmitButton label={t("Save password")} pending={pending} />
    </form>
  );
}

export function AcceptInviteForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const form = useForm<AcceptInviteInput>({
    defaultValues: { fullName: "", password: "" },
  });

  async function onSubmit(values: AcceptInviteInput) {
    setError(null);
    setPending(true);
    const result = await acceptInvite(values);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
      <TextField label={t("Your name")} autoComplete="name" {...form.register("fullName")} />
      <TextField
        label={t("Password")}
        type="password"
        autoComplete="new-password"
        {...form.register("password")}
      />
      <FormError message={error} />
      <SubmitButton label={t("Join class")} pending={pending} />
    </form>
  );
}
