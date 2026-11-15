"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { can } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/supabase/session";
import { getRequestOrigin } from "@/lib/site";
import { t } from "@/lib/t";
import { staffColumns, staffSchema, type StaffInput } from "@/lib/validation/staff";

const uuid = /^[0-9a-f-]{36}$/i;

async function requireManager() {
  const staff = await getStaff();
  if (!staff) {
    return { ok: false as const, error: t("Sign in to continue.") };
  }
  if (!can(staff, "staff.manage")) {
    return { ok: false as const, error: t("Only the class owner can do that.") };
  }
  return { ok: true as const, staff, supabase: await createClient() };
}

function firstIssue(message: string | undefined) {
  return t(message ?? "Check the form and try again.");
}

function saveError(error: { code?: string; message: string } | null) {
  if (error?.code === "PGRST205" || error?.code === "42P01" || error?.code === "PGRST202") {
    return t("The staff directory is not set up yet. Run 028_staff.sql in Supabase, then try again.");
  }
  if (error?.message.includes("cannot archive yourself")) {
    return t("You cannot archive yourself.");
  }
  if (error?.message.includes("course not found")) {
    return t("One of those courses was deleted. Refresh the page and choose again.");
  }
  return t("That could not be saved. Check your connection and try again.");
}

export async function createStaffMember(input: {
  staff: StaffInput;
}): Promise<ActionResult<{ staffId: string }>> {
  const parsed = staffSchema.safeParse(input.staff);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues[0]?.message) };
  }
  const manager = await requireManager();
  if (!manager.ok) {
    return manager;
  }
  const { data, error } = await manager.supabase
    .from("staff_members")
    .insert({ institute_id: manager.staff.institute.id, ...staffColumns(parsed.data) })
    .select("id")
    .single();
  if (error || !data) {
    console.error("createStaffMember", error?.code, error?.message);
    return { ok: false, error: saveError(error) };
  }
  refresh();
  return { ok: true, data: { staffId: data.id } };
}

// Save details and, when courseIds is given, the courses they teach.
export async function updateStaffMember(input: {
  staffId: string;
  staff: StaffInput;
  courseIds?: string[];
}): Promise<ActionResult> {
  if (!uuid.test(input.staffId)) {
    return { ok: false, error: t("That person is not on your staff.") };
  }
  if (input.courseIds && !input.courseIds.every((id) => uuid.test(id))) {
    return { ok: false, error: t("One of those courses was deleted. Refresh the page and choose again.") };
  }
  const parsed = staffSchema.safeParse(input.staff);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues[0]?.message) };
  }
  const manager = await requireManager();
  if (!manager.ok) {
    return manager;
  }
  const { data, error } = await manager.supabase
    .from("staff_members")
    .update(staffColumns(parsed.data))
    .eq("id", input.staffId)
    .eq("institute_id", manager.staff.institute.id)
    .eq("status", "active")
    .select("id")
    .maybeSingle();
  if (error || !data) {
    console.error("updateStaffMember", error?.code, error?.message);
    return { ok: false, error: saveError(error) };
  }
  if (input.courseIds) {
    const courses = await manager.supabase.rpc("set_staff_courses", {
      p_staff_id: input.staffId,
      p_course_ids: [...new Set(input.courseIds)],
    });
    if (courses.error) {
      console.error("updateStaffMember courses", courses.error.code, courses.error.message);
      refresh();
      return { ok: false, error: `${t("The details were saved, but the courses could not be changed.")} ${saveError(courses.error)}` };
    }
  }
  refresh();
  return { ok: true, data: undefined };
}

// Let a staff member sign in as a teacher. An existing account with that
// email is linked; otherwise an invite email goes out and they set a
// password from it.
export async function giveStaffLogin(input: {
  staffId: string;
  email: string;
}): Promise<ActionResult<string>> {
  const email = z.email().safeParse(input.email.trim().toLowerCase());
  if (!uuid.test(input.staffId) || !email.success) {
    return { ok: false, error: t("Enter a valid email.") };
  }
  const manager = await requireManager();
  if (!manager.ok) {
    return manager;
  }
  const { data: member } = await manager.supabase
    .from("staff_members")
    .select("id, profile_id, email")
    .eq("id", input.staffId)
    .eq("institute_id", manager.staff.institute.id)
    .eq("status", "active")
    .maybeSingle();
  if (!member) {
    return { ok: false, error: t("That person is not on your staff.") };
  }
  if (member.profile_id) {
    return { ok: false, error: t("They can already sign in.") };
  }

  const adminClient = createAdminClient();
  if (!adminClient.ok) {
    return adminClient;
  }
  const admin = adminClient.client;
  const instituteId = manager.staff.institute.id;

  const { data: existing } = await admin
    .from("profiles")
    .select("id, active_institute_id")
    .eq("email", email.data)
    .maybeSingle();
  let profileId = existing?.id ?? null;
  let invited = false;
  if (!profileId) {
    const origin = await getRequestOrigin();
    if (!origin) {
      return { ok: false, error: t("Something went wrong. Try again.") };
    }
    const result = await admin.auth.admin.inviteUserByEmail(email.data, {
      redirectTo: `${origin}/auth/callback?next=/accept-invite`,
    });
    if (result.error || !result.data.user) {
      const message = result.error?.message.toLowerCase() ?? "";
      return {
        ok: false,
        error: message.includes("already")
          ? t("That email already has an account. Ask them to sign in, then try again.")
          : t("That invite could not be sent."),
      };
    }
    profileId = result.data.user.id;
    invited = true;
    const { error: profileError } = await admin.from("profiles").insert({
      id: profileId,
      email: email.data,
      full_name: null,
      active_institute_id: instituteId,
    });
    if (profileError) {
      return { ok: false, error: t("That invite could not be sent.") };
    }
  } else if (!existing?.active_institute_id) {
    await admin.from("profiles").update({ active_institute_id: instituteId }).eq("id", profileId);
  }

  // As the signed-in admin, so the database checks staff.manage itself.
  const { error } = await manager.supabase.rpc("grant_staff_login", {
    p_staff_id: member.id,
    p_profile_id: profileId,
  });
  if (error) {
    console.error("giveStaffLogin", error.code, error.message);
    return {
      ok: false,
      error: error.message.includes("family account")
        ? t("That email belongs to a parent's account. Use a different email for staff.")
        : error.message.includes("already linked")
          ? t("That email is already linked to someone else on your staff.")
          : saveError(error),
    };
  }
  if (!member.email) {
    await manager.supabase.from("staff_members").update({ email: email.data }).eq("id", member.id);
  }
  refresh();
  return { ok: true, data: invited ? t("Invite sent. They set a password from the email, then sign in.") : t("Done. They can sign in with their existing account.") };
}

export async function archiveStaffMember(input: { staffId: string }): Promise<ActionResult> {
  if (!uuid.test(input.staffId)) {
    return { ok: false, error: t("That person is not on your staff.") };
  }
  const manager = await requireManager();
  if (!manager.ok) {
    return manager;
  }
  const { error } = await manager.supabase.rpc("archive_staff_member", { p_staff_id: input.staffId });
  if (error) {
    console.error("archiveStaffMember", error.code, error.message);
    return { ok: false, error: saveError(error) };
  }
  refresh();
  return { ok: true, data: undefined };
}

export async function restoreStaffMember(input: { staffId: string }): Promise<ActionResult> {
  if (!uuid.test(input.staffId)) {
    return { ok: false, error: t("That person is not on your staff.") };
  }
  const manager = await requireManager();
  if (!manager.ok) {
    return manager;
  }
  const { error } = await manager.supabase.rpc("restore_staff_member", { p_staff_id: input.staffId });
  if (error) {
    console.error("restoreStaffMember", error.code, error.message);
    return { ok: false, error: saveError(error) };
  }
  refresh();
  return { ok: true, data: undefined };
}
