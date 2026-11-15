"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FormError, SubmitButton } from "@/components/auth/form-bits";
import { TextField } from "@/components/form/text-field";
import { signUp } from "@/lib/actions/auth";
import { t } from "@/lib/t";
import type { SignUpInput } from "@/lib/validation/auth";

export function SignUpForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const form = useForm<SignUpInput>({
    defaultValues: { fullName: "", instituteName: "", email: "", password: "" },
  });

  async function onSubmit(values: SignUpInput) {
    setError(null);
    setNotice(null);
    setPending(true);
    const result = await signUp(values);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.data.needsEmailConfirmation) {
      setNotice(t("Check your email to finish creating your account."));
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
      <TextField label={t("Your name")} autoComplete="name" {...form.register("fullName")} />
      <TextField label={t("Class name")} {...form.register("instituteName")} />
      <TextField label={t("Email")} type="email" autoComplete="email" {...form.register("email")} />
      <TextField
        label={t("Password")}
        type="password"
        autoComplete="new-password"
        {...form.register("password")}
      />
      <FormError message={error} />
      {notice ? <p className="text-sm text-slate">{notice}</p> : null}
      <SubmitButton label={t("Create account")} pending={pending} />
      <p className="text-sm text-slate">
        <Link href="/sign-in" className="text-forest underline-offset-4 hover:underline">
          {t("Sign in")}
        </Link>
      </p>
    </form>
  );
}
