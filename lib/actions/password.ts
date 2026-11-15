"use server";

import type { ActionResult } from "@/lib/action-result";
import { caughtMessage, firstIssue } from "@/lib/auth-messages";
import { createClient } from "@/lib/supabase/server";
import { getRequestOrigin } from "@/lib/site";
import { t } from "@/lib/t";
import {
  acceptInviteSchema,
  emailSchema,
  passwordSchema,
  type AcceptInviteInput,
  type EmailInput,
  type PasswordInput,
} from "@/lib/validation/auth";

const passwordError = t(
  "That password could not be saved. Open the link from your email again.",
);

export async function requestPasswordReset(
  input: EmailInput,
): Promise<ActionResult> {
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues[0]?.message) };
  }

  try {
    const supabase = await createClient();
    const origin = await getRequestOrigin();
    if (!origin) {
      return { ok: false, error: t("Something went wrong. Try again.") };
    }
    const { error } = await supabase.auth.resetPasswordForEmail(
      parsed.data.email,
      { redirectTo: `${origin}/auth/callback?next=/reset-password` },
    );
    if (error) {
      return { ok: false, error: t("Something went wrong. Try again.") };
    }
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: caughtMessage(error) };
  }
}

export async function updatePassword(
  input: PasswordInput,
): Promise<ActionResult> {
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues[0]?.message) };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });
    if (error) {
      return { ok: false, error: passwordError };
    }
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: caughtMessage(error) };
  }
}

export async function acceptInvite(
  input: AcceptInviteInput,
): Promise<ActionResult> {
  const parsed = acceptInviteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues[0]?.message) };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return {
        ok: false,
        error: t(
          "That invite link has expired. Ask your class to send a new one.",
        ),
      };
    }

    const { error: passwordErrorResult } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });
    if (passwordErrorResult) {
      return { ok: false, error: passwordError };
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ full_name: parsed.data.fullName })
      .eq("id", user.id);
    if (profileError) {
      return { ok: false, error: t("Something went wrong. Try again.") };
    }

    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: caughtMessage(error) };
  }
}
