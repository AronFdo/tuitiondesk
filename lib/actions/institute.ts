"use server";

import type { ActionResult } from "@/lib/action-result";
import { normalizePhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaff } from "@/lib/supabase/session";
import { createClient } from "@/lib/supabase/server";
import { getRequestOrigin } from "@/lib/site";
import { t } from "@/lib/t";
import {
  instituteSchema,
  inviteTeacherSchema,
  dueDaysSchema,
  type DueDaysInput,
  type InstituteInput,
  type InviteTeacherInput,
} from "@/lib/validation/institute";

const phoneError = t(
  "That phone number looks incomplete. Use 10 digits, like 0771234567.",
);

function firstIssue(message: string | undefined) {
  return t(message ?? "Check the form and try again.");
}

function isTimezone(value: string) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

async function requireAdmin() {
  const staff = await getStaff();
  if (!staff) {
    return { ok: false as const, error: t("Sign in to continue.") };
  }
  if (staff.role !== "admin") {
    return {
      ok: false as const,
      error: t("Only the class owner can do that."),
    };
  }
  return { ok: true as const, staff };
}

export async function updateInstitute(
  input: InstituteInput,
): Promise<ActionResult> {
  const parsed = instituteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues[0]?.message) };
  }

  const admin = await requireAdmin();
  if (!admin.ok) {
    return admin;
  }

  const phone = normalizePhone(parsed.data.phone);
  if (!phone.ok) {
    return { ok: false, error: phoneError };
  }

  if (!isTimezone(parsed.data.timezone)) {
    return {
      ok: false,
      error: t("That timezone is not recognised. Use Asia/Colombo."),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("institutes")
    .update({
      name: parsed.data.name,
      phone: phone.e164,
      address: parsed.data.address.trim() || null,
      timezone: parsed.data.timezone,
    })
    .eq("id", admin.staff.institute.id);

  if (error) {
    return { ok: false, error: t("Those details could not be saved.") };
  }

  return { ok: true, data: undefined };
}

export async function updateDueDays(input: DueDaysInput): Promise<ActionResult> {
  const parsed = dueDaysSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues[0]?.message) };
  }

  const admin = await requireAdmin();
  if (!admin.ok) {
    return admin;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("institutes")
    .update({
      tuition_due_day: Number(parsed.data.tuitionDueDay),
    })
    .eq("id", admin.staff.institute.id);

  if (error) {
    const missing =
      error.code === "42703" ||
      error.code === "PGRST204" ||
      error.message.includes("tuition_due_day") ||
      error.message.includes("schema cache");
    return {
      ok: false,
      error: missing
        ? t("Due dates are not set up yet. Run the due dates SQL in Supabase, then refresh.")
        : t("Those dates could not be saved."),
    };
  }

  return { ok: true, data: undefined };
}

const logoTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function uploadLogo(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return admin;
  }

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: t("Choose a logo image.") };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { ok: false, error: t("That logo is too large. Use an image under 2 MB.") };
  }
  if (!logoTypes.has(file.type)) {
    return { ok: false, error: t("Use a PNG, JPEG, or WebP image.") };
  }

  const path = `${admin.staff.institute.id}/logo`;
  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage
    .from("institute-logos")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    return { ok: false, error: t("That logo could not be uploaded.") };
  }

  const { error: updateError } = await supabase
    .from("institutes")
    .update({ logo_path: path })
    .eq("id", admin.staff.institute.id);

  if (updateError) {
    return { ok: false, error: t("That logo could not be saved.") };
  }

  return { ok: true, data: undefined };
}

export async function inviteTeacher(
  input: InviteTeacherInput,
): Promise<ActionResult> {
  const parsed = inviteTeacherSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues[0]?.message) };
  }

  const admin = await requireAdmin();
  if (!admin.ok) {
    return admin;
  }

  const origin = await getRequestOrigin();
  if (!origin) {
    return { ok: false, error: t("Something went wrong. Try again.") };
  }

  const adminClient = createAdminClient();
  if (!adminClient.ok) {
    return adminClient;
  }

  const { data, error } = await adminClient.client.auth.admin.inviteUserByEmail(
    parsed.data.email,
    { redirectTo: `${origin}/auth/callback?next=/accept-invite` },
  );

  if (error || !data.user) {
    const message = error?.message.toLowerCase() ?? "";
    if (message.includes("already")) {
      return { ok: false, error: t("That email already has an account.") };
    }
    return { ok: false, error: t("That invite could not be sent.") };
  }

  const { error: profileError } = await adminClient.client.from("profiles").insert({
    id: data.user.id,
    email: parsed.data.email,
    full_name: null,
    active_institute_id: admin.staff.institute.id,
  });

  if (profileError) {
    return { ok: false, error: t("That invite could not be sent.") };
  }

  const { error: membershipError } = await adminClient.client
    .from("memberships")
    .insert({
      institute_id: admin.staff.institute.id,
      profile_id: data.user.id,
      role: "teacher",
    });

  if (membershipError) {
    return { ok: false, error: t("That invite could not be sent.") };
  }

  return { ok: true, data: undefined };
}
