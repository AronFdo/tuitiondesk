import { loadCourseFees, type CourseFee } from "@/lib/course-fees";
import { minorToLkrInput } from "@/lib/money";
import { can } from "@/lib/permissions";
import { parseSchedule } from "@/lib/schedule";
import { createClient } from "@/lib/supabase/server";
import { getStaff, type StaffContext } from "@/lib/supabase/session";
import { t } from "@/lib/t";
import type { CourseInput } from "@/lib/validation/course";

export type CourseListItem = {
  id: string;
  name: string;
  level: string | null;
  scheduleText: string | null;
  monthlyFeeMinor: number;
  tuitionDueDay: number | null;
  studentCount: number;
  form: CourseInput;
};

export type TeacherOption = { id: string; name: string };

// Fees are not in here: they are read through loadCourseFees, and only by
// staff with fees.view.
export const COURSE_COLUMNS =
  "id, name, level, teacher_profile_id, schedule_text, description";

// A course row with its fee, or no fee for someone who may not see fees.
export function withCourseFee<T extends { id: string }>(
  course: T,
  fees: Map<string, CourseFee> | null,
): T & { monthly_fee_minor: number; tuition_due_day: number | null } {
  const fee = fees?.get(course.id);
  return {
    ...course,
    monthly_fee_minor: fee?.monthlyFeeMinor ?? 0,
    tuition_due_day: fee?.tuitionDueDay ?? null,
  };
}

type CourseFormRow = {
  name: string;
  level: string | null;
  teacher_profile_id: string | null;
  schedule_text: string | null;
  monthly_fee_minor: number;
  tuition_due_day: number | null;
  description: string | null;
};

export function courseForm(course: CourseFormRow): CourseInput {
  const schedule = parseSchedule(course.schedule_text);
  return {
    name: course.name,
    level: course.level ?? "",
    teacherProfileId: course.teacher_profile_id ?? "",
    scheduleDay: schedule.day,
    scheduleTime: schedule.time,
    monthlyFee: minorToLkrInput(course.monthly_fee_minor),
    tuitionDueDay: course.tuition_due_day ? String(course.tuition_due_day) : "",
    description: course.description ?? "",
  };
}

type LoadError = { status: "error"; missing: boolean };
type SignedOut = { status: "signed-out" };

function missingTable(error: { code?: string; message: string }) {
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    error.code === "PGRST202" ||
    error.message.includes("schema cache")
  );
}

export async function loadCoursesPage(): Promise<
  | SignedOut
  | LoadError
  | {
      status: "ready";
      staff: StaffContext;
      courses: CourseListItem[];
      teachers: TeacherOption[];
    }
> {
  const staff = await getStaff();
  if (!staff) {
    return { status: "signed-out" };
  }

  const supabase = await createClient();
  const coursesResult = await supabase
    .from("courses")
    .select(COURSE_COLUMNS)
    .eq("institute_id", staff.institute.id)
    .is("archived_at", null)
    .order("name");

  if (coursesResult.error) {
    return { status: "error", missing: missingTable(coursesResult.error) };
  }

  const visible = (coursesResult.data ?? []).filter(
    (course) =>
      can(staff, "courses.all") || course.teacher_profile_id === staff.userId,
  );
  const courseIds = visible.map((course) => course.id);

  const [enrollmentResult, teachers, fees] = await Promise.all([
    courseIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from("enrollments")
          .select("course_id")
          .in("course_id", courseIds)
          .is("end_date", null),
    can(staff, "courses.manage")
      ? loadTeacherOptions(staff.institute.id)
      : Promise.resolve([]),
    can(staff, "fees.view") ? loadCourseFees(supabase, courseIds) : null,
  ]);

  if (enrollmentResult.error) {
    return { status: "error", missing: missingTable(enrollmentResult.error) };
  }
  if (fees && !fees.ok) {
    return { status: "error", missing: missingTable(fees.error) };
  }

  const counts = new Map<string, number>();
  for (const enrollment of enrollmentResult.data ?? []) {
    counts.set(enrollment.course_id, (counts.get(enrollment.course_id) ?? 0) + 1);
  }

  return {
    status: "ready",
    staff,
    teachers,
    courses: visible
      .map((row) => withCourseFee(row, fees?.fees ?? null))
      .map((course) => ({
      id: course.id,
      name: course.name,
      level: course.level,
      scheduleText: course.schedule_text,
      monthlyFeeMinor: course.monthly_fee_minor,
      tuitionDueDay: course.tuition_due_day,
      studentCount: counts.get(course.id) ?? 0,
      form: courseForm(course),
    })),
  };
}

export async function loadTeacherOptions(
  instituteId: string,
): Promise<TeacherOption[]> {
  const supabase = await createClient();
  const memberships = await supabase
    .from("memberships")
    .select("profile_id")
    .eq("institute_id", instituteId)
    .in("role", ["admin", "teacher"]);

  const ids = (memberships.data ?? []).map((row) => row.profile_id);
  if (ids.length === 0) {
    return [];
  }

  const profiles = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", ids);

  return (profiles.data ?? [])
    .map((profile) => ({
      id: profile.id,
      name: profile.full_name?.trim() || t("Staff member"),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
