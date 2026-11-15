import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { getStaff, type StaffContext } from "@/lib/supabase/session";
import { t } from "@/lib/t";
import { STAFF_COLUMNS, type StaffRow } from "@/lib/validation/staff";

// The staff directory (supabase/sql/028), for staff with staff.manage.

export type StaffLogin = "admin" | "teacher" | null;

export function loginLabel(login: StaffLogin) {
  return login === "admin" ? t("Admin login") : login === "teacher" ? t("Teacher login") : t("No login");
}

export type StaffListItem = {
  id: string;
  fullName: string;
  title: string | null;
  phone: string | null;
  login: StaffLogin;
  courseCount: number;
};

export type StaffMember = {
  id: string;
  details: StaffRow;
  status: "active" | "archived";
  leftOn: string | null;
  login: StaffLogin;
  isSelf: boolean;
  courses: { id: string; name: string }[];
};

type Failure =
  | { status: "signed-out" }
  | { status: "forbidden" }
  | { status: "error"; missing: boolean };

function missingTable(error: { code?: string; message: string }) {
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    error.code === "42703" ||
    error.message.includes("schema cache")
  );
}

async function manager(): Promise<{ ok: true; staff: StaffContext } | { ok: false; failure: Failure }> {
  const staff = await getStaff();
  if (!staff) {
    return { ok: false, failure: { status: "signed-out" } };
  }
  if (!can(staff, "staff.manage")) {
    return { ok: false, failure: { status: "forbidden" } };
  }
  return { ok: true, staff };
}

async function loginRoles(instituteId: string, profileIds: string[]) {
  const roles = new Map<string, StaffLogin>();
  if (profileIds.length === 0) {
    return roles;
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("memberships")
    .select("profile_id, role")
    .eq("institute_id", instituteId)
    .in("profile_id", profileIds)
    .in("role", ["admin", "teacher"]);
  for (const row of data ?? []) {
    roles.set(row.profile_id, row.role as StaffLogin);
  }
  return roles;
}

export async function loadStaffList({ archived = false }: { archived?: boolean } = {}): Promise<
  Failure | { status: "ready"; staff: StaffListItem[] }
> {
  const access = await manager();
  if (!access.ok) {
    return access.failure;
  }
  const instituteId = access.staff.institute.id;
  const supabase = await createClient();
  const [membersResult, coursesResult] = await Promise.all([
    supabase
      .from("staff_members")
      .select("id, profile_id, full_name, title, phone")
      .eq("institute_id", instituteId)
      .eq("status", archived ? "archived" : "active")
      .order("full_name"),
    supabase
      .from("courses")
      .select("teacher_profile_id")
      .eq("institute_id", instituteId)
      .is("archived_at", null)
      .not("teacher_profile_id", "is", null),
  ]);
  if (membersResult.error) {
    return { status: "error", missing: missingTable(membersResult.error) };
  }
  const members = membersResult.data ?? [];
  const roles = await loginRoles(
    instituteId,
    members.map((row) => row.profile_id).filter((id): id is string => Boolean(id)),
  );
  const courseCounts = new Map<string, number>();
  for (const course of coursesResult.data ?? []) {
    if (course.teacher_profile_id) {
      courseCounts.set(course.teacher_profile_id, (courseCounts.get(course.teacher_profile_id) ?? 0) + 1);
    }
  }

  return {
    status: "ready",
    staff: members.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      title: row.title,
      phone: row.phone,
      login: row.profile_id ? (roles.get(row.profile_id) ?? null) : null,
      courseCount: row.profile_id ? (courseCounts.get(row.profile_id) ?? 0) : 0,
    })),
  };
}

export async function loadStaffMember(staffId: string): Promise<
  Failure | { status: "not-found" } | { status: "ready"; member: StaffMember; allCourses: { id: string; name: string }[] }
> {
  const access = await manager();
  if (!access.ok) {
    return access.failure;
  }
  if (!/^[0-9a-f-]{36}$/i.test(staffId)) {
    return { status: "not-found" };
  }
  const instituteId = access.staff.institute.id;
  const supabase = await createClient();
  const [memberResult, coursesResult] = await Promise.all([
    supabase
      .from("staff_members")
      .select(`id, profile_id, status, left_on, ${STAFF_COLUMNS}`)
      .eq("id", staffId)
      .eq("institute_id", instituteId)
      .maybeSingle(),
    supabase
      .from("courses")
      .select("id, name, teacher_profile_id")
      .eq("institute_id", instituteId)
      .is("archived_at", null)
      .order("name"),
  ]);
  if (memberResult.error) {
    return { status: "error", missing: missingTable(memberResult.error) };
  }
  if (coursesResult.error) {
    return { status: "error", missing: false };
  }
  const row = memberResult.data;
  if (!row) {
    return { status: "not-found" };
  }
  const roles = row.profile_id ? await loginRoles(instituteId, [row.profile_id]) : new Map();
  const courses = coursesResult.data ?? [];

  return {
    status: "ready",
    member: {
      id: row.id,
      details: row as unknown as StaffRow,
      status: row.status === "archived" ? "archived" : "active",
      leftOn: row.left_on,
      login: row.profile_id ? (roles.get(row.profile_id) ?? null) : null,
      isSelf: row.profile_id === access.staff.userId,
      courses: row.profile_id
        ? courses
            .filter((course) => course.teacher_profile_id === row.profile_id)
            .map((course) => ({ id: course.id, name: course.name }))
        : [],
    },
    allCourses: courses.map((course) => ({ id: course.id, name: course.name })),
  };
}
