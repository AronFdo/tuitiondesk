"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { parseCardPayload } from "@/lib/student-card";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/supabase/session";
import { t } from "@/lib/t";

const uuid = /^[0-9a-f-]{36}$/i;

async function requireAdmin() {
  const staff = await getStaff();
  if (!staff) {
    return { ok: false as const, error: t("Sign in to continue.") };
  }
  if (staff.role !== "admin") {
    return { ok: false as const, error: t("Only the class owner can do that.") };
  }
  return { ok: true as const, staff, supabase: await createClient() };
}

// The browser finished a print. Later prints of the same receipt say COPY.
export async function markReceiptPrinted(input: { receiptId: string }): Promise<ActionResult> {
  if (!uuid.test(input.receiptId)) {
    return { ok: false, error: t("That receipt is not in this class.") };
  }
  const admin = await requireAdmin();
  if (!admin.ok) {
    return admin;
  }
  const { error } = await admin.supabase.rpc("mark_receipt_printed", { p_receipt_id: input.receiptId });
  if (error) {
    console.error("markReceiptPrinted", error.code, error.message);
    return { ok: false, error: t("The print could not be counted. Check your connection and try again.") };
  }
  return { ok: true, data: undefined };
}

// A scanned card at the payments desk: who it belongs to and their courses.
export async function findStudentByCard(input: {
  scanned: string;
}): Promise<ActionResult<{ studentId: string; fullName: string; courseIds: string[] } | null>> {
  const token = parseCardPayload(input.scanned);
  if (!token) {
    return { ok: true, data: null };
  }
  const admin = await requireAdmin();
  if (!admin.ok) {
    return admin;
  }
  const instituteId = admin.staff.institute.id;
  const { data: student, error } = await admin.supabase
    .from("students")
    .select("id, full_name")
    .eq("institute_id", instituteId)
    .eq("qr_token", token)
    .eq("status", "active")
    .maybeSingle();
  if (error) {
    return { ok: false, error: t("That card could not be looked up. Check your connection and try again.") };
  }
  if (!student) {
    return { ok: true, data: null };
  }
  const { data: enrolments } = await admin.supabase
    .from("enrollments")
    .select("course_id")
    .eq("institute_id", instituteId)
    .eq("student_id", student.id)
    .is("end_date", null);
  return {
    ok: true,
    data: {
      studentId: student.id,
      fullName: student.full_name,
      courseIds: (enrolments ?? []).map((row) => row.course_id),
    },
  };
}

const receiptSettingsSchema = z.object({
  paperMm: z.enum(["58", "80"], "Choose the paper width."),
  footer: z.string().trim().max(200, "Keep the footer under 200 characters."),
});

export type ReceiptSettingsInput = z.infer<typeof receiptSettingsSchema>;

export async function updateReceiptSettings(input: ReceiptSettingsInput): Promise<ActionResult> {
  const parsed = receiptSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: t(parsed.error.issues[0]?.message ?? "Check the form and try again.") };
  }
  const admin = await requireAdmin();
  if (!admin.ok) {
    return admin;
  }
  const { error } = await admin.supabase
    .from("institutes")
    .update({
      receipt_paper_mm: Number(parsed.data.paperMm),
      receipt_footer: parsed.data.footer || null,
    })
    .eq("id", admin.staff.institute.id);
  if (error) {
    console.error("updateReceiptSettings", error.code, error.message);
    return {
      ok: false,
      error:
        error.code === "42703" || error.code === "PGRST204"
          ? t("Receipts are not set up yet. Run 021_receipts.sql in Supabase, then try again.")
          : t("Those settings could not be saved. Check your connection and try again."),
    };
  }
  refresh();
  return { ok: true, data: undefined };
}
