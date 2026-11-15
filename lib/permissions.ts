import type { MembershipRole } from "@/lib/supabase/database.types";

// What each role may do. Pages, loaders and server actions ask can() instead
// of comparing roles, so adding a role or moving a permission is one edit here
// plus the matching row in public.has_permission() (supabase/sql/024 and
// later). tests/permissions.test.ts checks the two lists agree.
export const PERMISSIONS = [
  // See fees, payments, receipts, dues and fee totals.
  "fees.view",
  // Record or void payments and print receipts.
  "fees.record",
  // Add, edit, import and archive students; reissue cards; change photos.
  "students.manage",
  "students.documents",
  // Read the change log of a student's details.
  "students.history",
  // Add, edit and archive courses; enrol and remove students.
  "courses.manage",
  // See and run every course, not only the ones you teach.
  "courses.all",
  // Institute settings: name, logo, due days, receipts.
  "institute.manage",
  "staff.manage",
  "parents.invite",
  // Post notices to the whole class, not only to a course you teach.
  "notices.class",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type StaffRole = Extract<MembershipRole, "admin" | "teacher">;

// Teachers have no extra permissions: they run attendance, notices and files
// for the courses they teach, which is checked against the course itself.
export const ROLE_PERMISSIONS: Record<StaffRole, readonly Permission[]> = {
  admin: PERMISSIONS,
  teacher: [],
};

function isStaffRole(role: string): role is StaffRole {
  return Object.hasOwn(ROLE_PERMISSIONS, role);
}

// Takes a staff context or a membership row; parents, students and anyone
// signed out have no staff permissions.
export function can(
  who: { role: string } | null | undefined,
  permission: Permission,
): boolean {
  return Boolean(
    who && isStaffRole(who.role) && ROLE_PERMISSIONS[who.role].includes(permission),
  );
}
