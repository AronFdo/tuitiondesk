"use server";

import { refresh, revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { parseLkrToMinor } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/t";
import {
  paymentIdSchema,
  tuitionPaymentSchema,
  type TuitionPaymentInput,
} from "@/lib/validation/fees";

function firstIssue(message: string | undefined) {
  return t(message ?? "Check the form and try again.");
}

async function signedInClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: t("Sign in to continue.") };
  }
  return { ok: true as const, supabase, userId: user.id };
}

async function requireAdmin() {
  const session = await signedInClient();
  if (!session.ok) {
    return session;
  }
  const { data: profile } = await session.supabase
    .from("profiles")
    .select("active_institute_id")
    .eq("id", session.userId)
    .maybeSingle();
  if (!profile?.active_institute_id) {
    return { ok: false as const, error: t("Sign in to continue.") };
  }
  const { data: membership } = await session.supabase
    .from("memberships")
    .select("role")
    .eq("profile_id", session.userId)
    .eq("institute_id", profile.active_institute_id)
    .maybeSingle();
  if (membership?.role !== "admin") {
    return {
      ok: false as const,
      error: t("Only the class owner can do that."),
    };
  }
  return {
    ok: true as const,
    supabase: session.supabase,
    userId: session.userId,
    instituteId: profile.active_institute_id,
  };
}

function requiredAmount(input: string) {
  const fee = parseLkrToMinor(input);
  if (!fee.ok || fee.minor <= 0) {
    return {
      ok: false as const,
      error: t("Enter the amount in rupees, like 12500."),
    };
  }
  return { ok: true as const, minor: fee.minor };
}

export async function recordTuitionPayment(
  input: TuitionPaymentInput,
): Promise<ActionResult<{ receiptId: string; receiptNo: number }>> {
  const parsed = tuitionPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues[0]?.message) };
  }
  const amount = requiredAmount(parsed.data.amount);
  if (!amount.ok) {
    return amount;
  }
  const admin = await requireAdmin();
  if (!admin.ok) {
    return admin;
  }

  // The payment and its numbered receipt are saved together.
  const { data, error } = await admin.supabase.rpc("record_tuition_payment", {
    p_course_id: parsed.data.courseId,
    p_student_id: parsed.data.studentId,
    p_amount_minor: amount.minor,
    p_paid_on: parsed.data.paidOn,
    p_period_month: `${parsed.data.periodMonth}-01`,
  });
  const receipt = data as { receipt_id?: unknown; receipt_no?: unknown } | null;
  if (error || typeof receipt?.receipt_id !== "string" || typeof receipt.receipt_no !== "number") {
    console.error("recordTuitionPayment", error?.code, error?.message);
    return {
      ok: false,
      error: error?.message.includes("not enrolled")
        ? t("That student is not on that course. Choose the course they are on.")
        : t("That payment could not be saved. Check your connection and try again."),
    };
  }
  dashboardChanged();
  return { ok: true, data: { receiptId: receipt.receipt_id, receiptNo: receipt.receipt_no } };
}

export async function voidTuitionPayment(input: {
  paymentId: string;
}): Promise<ActionResult> {
  return voidPayment(input.paymentId);
}

async function voidPayment(paymentId: string): Promise<ActionResult> {
  const parsed = paymentIdSchema.safeParse({ paymentId });
  if (!parsed.success) {
    return { ok: false, error: t("That payment could not be deleted. Check your connection and try again.") };
  }
  const admin = await requireAdmin();
  if (!admin.ok) {
    return admin;
  }

  const { data, error } = await admin.supabase
    .from("tuition_payments")
    .update({ voided_at: new Date().toISOString() })
    .eq("id", parsed.data.paymentId)
    .eq("institute_id", admin.instituteId)
    .is("voided_at", null)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, error: t("That payment could not be deleted. Check your connection and try again.") };
  }
  await admin.supabase.from("activity_log").insert({
    institute_id: admin.instituteId,
    actor_profile_id: admin.userId,
    action: "tuition_payment_voided",
    entity: "tuition_payments",
    entity_id: data.id,
  });
  dashboardChanged();
  return { ok: true, data: undefined };
}

// The dashboard shows payment totals, so drop its cached copy as well as
// refreshing this page.
function dashboardChanged() {
  revalidatePath("/dashboard");
  refresh();
}
