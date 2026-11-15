"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { can } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/supabase/session";
import { getRequestOrigin } from "@/lib/site";
import { loginDoneText, loginProblemText, type LoginProblem } from "@/lib/staff-login";
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
    return t("The staff directory is not set up yet. Run the files in supabase/sql up to 029_staff_roles.sql in Supabase, then try again.");
  }
  if (error?.message.includes("cannot archive yourself")) {
    return t("You cannot archive yourself.");
  }
  if (error?.message.includes("course not found")) {
    return t("One of those courses was deleted. Refresh the page and choose again.");
  }
  return t("That could not be saved. Check your connection and try again.");
}

// Add a staff member and, when login is given, let them sign in straight
// away using the email on the form. If the person is saved but the login
// cannot be set up, the result says why so their page can explain it.
export async function createStaffMember(input: {
  staff: StaffInput;
  login?: { role: string };
}): Promise<
  ActionResult<{
    staffId: string;
    login: "invited" | "linked" | LoginProblem | null;
  }>
> {
  const parsed = staffSchema.safeParse(input.staff);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues[0]?.message) };
  }
  if (input.login) {
    if (!isStaffRole(input.login.role)) {
      return { ok: false, error: t("Choose teacher or admin.") };
    }
    if (!parsed.data.email) {
      return { ok: false, error: t("Enter their email so the invite has somewhere to go.") };
    }
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

  let login: "invited" | "linked" | LoginProblem | null = null;
  if (input.login && parsed.data.email && isStaffRole(input.login.role)) {
    const result = await grantLogin(
      manager,
      { id: data.id, email: parsed.data.email },
      parsed.data.email,
      input.login.role,
    );
    login = result.ok ? (result.invited ? "invited" : "linked") : result.problem;
  }
  refresh();
  return { ok: true, data: { staffId: data.id, login } };
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

type StaffRole = "admin" | "teacher";
const isStaffRole = (value: string): value is StaffRole => value === "admin" || value === "teacher";

type Manager = Extract<Awaited<ReturnType<typeof requireManager>>, { ok: true }>;

// Find or invite the account for this email, then link it to the staff row
// with the given role. Shared by the add form and "Give login access".
async function grantLogin(
  manager: Manager,
  member: { id: string; email: string | null },
  email: string,
  role: StaffRole,
): Promise<{ ok: true; invited: boolean } | { ok: false; problem: LoginProblem }> {
  const adminClient = createAdminClient();
  if (!adminClient.ok) {
    return { ok: false, problem: "failed" };
  }
  const admin = adminClient.client;
  const instituteId = manager.staff.institute.id;

  const { data: existing } = await admin
    .from("profiles")
    .select("id, active_institute_id")
    .eq("email", email)
    .maybeSingle();
  let profileId = existing?.id ?? null;
  let invited = false;
  if (!profileId) {
    const origin = await getRequestOrigin();
    if (!origin) {
      return { ok: false, problem: "failed" };
    }
    const result = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/accept-invite`,
    });
    if (result.error || !result.data.user) {
      const message = result.error?.message.toLowerCase() ?? "";
      return { ok: false, problem: message.includes("already") ? "exists" : "failed" };
    }
    profileId = result.data.user.id;
    invited = true;
    const { error: profileError } = await admin.from("profiles").insert({
      id: profileId,
      email,
      full_name: null,
      active_institute_id: instituteId,
    });
    if (profileError) {
      return { ok: false, problem: "failed" };
    }
  } else if (!existing?.active_institute_id) {
    await admin.from("profiles").update({ active_institute_id: instituteId }).eq("id", profileId);
  }

  // As the signed-in admin, so the database checks staff.manage itself.
  const { error } = await manager.supabase.rpc("grant_staff_login", {
    p_staff_id: member.id,
    p_profile_id: profileId,
    p_role: role,
  });
  if (error) {
    console.error("grantLogin", error.code, error.message);
    return {
      ok: false,
      problem: error.message.includes("family account")
        ? "family"
        : error.message.includes("already linked")
          ? "linked"
          : "failed",
    };
  }
  if (!member.email) {
    await manager.supabase.from("staff_members").update({ email }).eq("id", member.id);
  }
  return { ok: true, invited };
}

// Let a staff member sign in, as a teacher or an admin. An existing account
// with that email is linked (keeping any role it already has here);
// otherwise an invite email goes out and they set a password from it.
export async function giveStaffLogin(input: {
  staffId: string;
  email: string;
  role: string;
}): Promise<ActionResult<string>> {
  const email = z.email().safeParse(input.email.trim().toLowerCase());
  if (!uuid.test(input.staffId) || !email.success) {
    return { ok: false, error: t("Enter a valid email.") };
  }
  if (!isStaffRole(input.role)) {
    return { ok: false, error: t("Choose teacher or admin.") };
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
  const result = await grantLogin(manager, member, email.data, input.role);
  if (!result.ok) {
    return { ok: false, error: loginProblemText(result.problem) };
  }
  refresh();
  return { ok: true, data: loginDoneText(result.invited) };
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

// Switch a login between teacher and admin. Nobody changes their own role.
export async function setStaffRole(input: { staffId: string; role: string }): Promise<ActionResult> {
  if (!uuid.test(input.staffId) || !isStaffRole(input.role)) {
    return { ok: false, error: t("Choose teacher or admin.") };
  }
  const manager = await requireManager();
  if (!manager.ok) {
    return manager;
  }
  const { error } = await manager.supabase.rpc("set_staff_role", {
    p_staff_id: input.staffId,
    p_role: input.role,
  });
  if (error) {
    console.error("setStaffRole", error.code, error.message);
    return {
      ok: false,
      error: error.code === "PGRST202"
        ? t("Changing roles is not set up yet. Run 029_staff_roles.sql in Supabase, then try again.")
        : error.message.includes("own role")
          ? t("You cannot change your own role. Ask another admin.")
          : error.message.includes("no login")
            ? t("They need login access first.")
            : saveError(error),
    };
  }
  refresh();
  return { ok: true, data: undefined };
}
