"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FormError, SubmitButton } from "@/components/auth/form-bits";
import { TextField } from "@/components/form/text-field";
import { signIn } from "@/lib/actions/auth";
import { safeNextPath } from "@/lib/next-path";
import { t } from "@/lib/t";
import type { SignInInput } from "@/lib/validation/auth";

export function SignInForm() {
  const router = useRouter();
  // Where to go after signing in, such as a scanned student card.
  const next = safeNextPath(useSearchParams().get("next"));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const form = useForm<SignInInput>({
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: SignInInput) {
    setError(null);
    setPending(true);
    const result = await signIn(values);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
      <TextField label={t("Email")} type="email" autoComplete="email" {...form.register("email")} />
      <div className="flex flex-col gap-2">
        <TextField
          label={t("Password")}
          type="password"
          autoComplete="current-password"
          {...form.register("password")}
        />
        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-sm text-forest underline-offset-4 hover:underline"
          >
            {t("Forgot password?")}
          </Link>
        </div>
      </div>
      <FormError message={error} />
      <SubmitButton label={t("Sign in")} pending={pending} />
      <p className="text-center text-sm text-slate">
        {t("No class yet?")}{" "}
        <Link href="/sign-up" className="text-forest underline-offset-4 hover:underline">
          {t("Create an account")}
        </Link>
      </p>
    </form>
  );
}
