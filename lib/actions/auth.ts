"use server";

import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import {
  caughtMessage,
  firstIssue,
  friendlyAuthError,
} from "@/lib/auth-messages";
import { createClient } from "@/lib/supabase/server";
import { getRequestOrigin } from "@/lib/site";
import {
  signInSchema,
  signUpSchema,
  type SignInInput,
  type SignUpInput,
} from "@/lib/validation/auth";

export async function signUp(
  input: SignUpInput,
): Promise<ActionResult<{ needsEmailConfirmation: boolean }>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues[0]?.message) };
  }

  try {
    const supabase = await createClient();
    const origin = await getRequestOrigin();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: {
          full_name: parsed.data.fullName,
          institute_name: parsed.data.instituteName,
        },
        emailRedirectTo: origin
          ? `${origin}/auth/callback?next=/dashboard`
          : undefined,
      },
    });

    if (error) {
      return { ok: false, error: friendlyAuthError(error.message) };
    }

    return {
      ok: true,
      data: { needsEmailConfirmation: !data.session },
    };
  } catch (error) {
    return { ok: false, error: caughtMessage(error) };
  }
}

export async function signIn(input: SignInInput): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues[0]?.message) };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error) {
      return { ok: false, error: friendlyAuthError(error.message) };
    }
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: caughtMessage(error) };
  }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
