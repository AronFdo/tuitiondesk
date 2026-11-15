import { studentAttendance, type CourseAttendance } from "@/lib/attendance-stats";
import { colomboToday } from "@/lib/dates";
import { loadStudentFacts } from "@/lib/student-context";
import { signedPhotoUrls } from "@/lib/student-photos";
import { createClient } from "@/lib/supabase/server";
import { getStaff, type StaffContext } from "@/lib/supabase/session";
import { can } from "@/lib/permissions";

export type RunnableCourse = { id: string; name: string; scheduleText: string | null };

export type SessionSummary = {
  id: string;
  courseId: string;
  courseName: string;
  heldOn: string;
  open: boolean;
  present: number;
  enrolled: number;
};

export type RosterStudent = {
  id: string;
  fullName: string;
  code: string;
  photoUrl: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  // Tuition due date already passed. Class owner only; false for teachers.
  feesOverdue: boolean;
};

export type SessionMark = {
  studentId: string;
  scannedAt: string;
  source: "scanner" | "camera" | "manual";
};

export type SessionPage = {
  session: { id: string; heldOn: string; open: boolean };
  course: { id: string; name: string };
  roster: RosterStudent[];
  marks: SessionMark[];
  instituteName: string;
};

const isUuid = (value: string) => /^[0-9a-f-]{36}$/i.test(value);

function missingTable(error: { code?: string; message: string }) {
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    error.code === "42703" ||
    error.message.includes("schema cache")
  );
}

// The classes this person can take attendance for.
async function runnableCourses(staff: StaffContext) {
  const supabase = await createClient();
  let query = supabase
    .from("courses")
    .select("id, name, schedule_text")
    .eq("institute_id", staff.institute.id)
    .is("archived_at", null)
    .order("name");
  if (!can(staff, "courses.all")) {
    query = query.eq("teacher_profile_id", staff.userId);
  }
  return query;
}

export async function loadAttendanceHome(): Promise<
  | { status: "signed-out" }
  | { status: "error"; missing: boolean }
  | { status: "ready"; today: string; courses: RunnableCourse[]; sessions: SessionSummary[] }
> {
  const staff = await getStaff();
  if (!staff) {
    return { status: "signed-out" };
  }
  const supabase = await createClient();
  const today = colomboToday();
  const [coursesResult, sessionsResult] = await Promise.all([
    runnableCourses(staff),
    supabase
      .from("class_sessions")
      .select("id, course_id, held_on, closed_at")
      .eq("institute_id", staff.institute.id)
      .order("held_on", { ascending: false })
      .order("opened_at", { ascending: false })
      .limit(40),
  ]);
  const firstError = coursesResult.error ?? sessionsResult.error;
  if (firstError) {
    return { status: "error", missing: missingTable(firstError) };
  }

  const sessions = sessionsResult.data ?? [];
  const sessionIds = sessions.map((session) => session.id);
  const courseIds = [...new Set(sessions.map((session) => session.course_id))];
  const [marksResult, enrolledResult, namesResult] = await Promise.all([
    sessionIds.length === 0
      ? { data: [], error: null }
      : supabase.from("attendance").select("session_id").in("session_id", sessionIds).is("voided_at", null),
    courseIds.length === 0
      ? { data: [], error: null }
      : supabase.from("enrollments").select("course_id").in("course_id", courseIds).is("end_date", null),
    courseIds.length === 0
      ? { data: [], error: null }
      : supabase.from("courses").select("id, name").in("id", courseIds),
  ]);
  if (marksResult.error || enrolledResult.error || namesResult.error) {
    return { status: "error", missing: false };
  }

  const present = countBy((marksResult.data ?? []).map((row) => row.session_id));
  const enrolled = countBy((enrolledResult.data ?? []).map((row) => row.course_id));
  const names = new Map((namesResult.data ?? []).map((row) => [row.id, row.name]));

  return {
    status: "ready",
    today,
    courses: (coursesResult.data ?? []).map((course) => ({
      id: course.id,
      name: course.name,
      scheduleText: course.schedule_text,
    })),
    sessions: sessions.map((session) => ({
      id: session.id,
      courseId: session.course_id,
      courseName: names.get(session.course_id) ?? "",
      heldOn: session.held_on,
      open: session.closed_at === null,
      present: present.get(session.id) ?? 0,
      enrolled: enrolled.get(session.course_id) ?? 0,
    })),
  };
}

export async function loadSessionPage(sessionId: string): Promise<
  | { status: "signed-out" }
  | { status: "not-found" }
  | { status: "error"; missing: boolean }
  | { status: "ready"; page: SessionPage }
> {
  const staff = await getStaff();
  if (!staff) {
    return { status: "signed-out" };
  }
  if (!isUuid(sessionId)) {
    return { status: "not-found" };
  }
  const supabase = await createClient();
  const instituteId = staff.institute.id;
  const sessionResult = await supabase
    .from("class_sessions")
    .select("id, course_id, held_on, closed_at")
    .eq("id", sessionId)
    .eq("institute_id", instituteId)
    .maybeSingle();
  if (sessionResult.error) {
    return { status: "error", missing: missingTable(sessionResult.error) };
  }
  const session = sessionResult.data;
  if (!session) {
    return { status: "not-found" };
  }

  const [courseResult, enrolmentsResult, marksResult] = await Promise.all([
    supabase.from("courses").select("id, name").eq("id", session.course_id).maybeSingle(),
    supabase
      .from("enrollments")
      .select("student_id")
      .eq("course_id", session.course_id)
      .is("end_date", null),
    supabase
      .from("attendance")
      .select("student_id, scanned_at, source")
      .eq("session_id", session.id)
      .is("voided_at", null)
      .order("scanned_at", { ascending: false }),
  ]);
  if (courseResult.error || enrolmentsResult.error || marksResult.error || !courseResult.data) {
    return { status: "error", missing: false };
  }

  const studentIds = [...new Set((enrolmentsResult.data ?? []).map((row) => row.student_id))];
  const studentsResult =
    studentIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("students")
          .select("id, full_name, student_code, photo_path, guardian_name, guardian_phone")
          .in("id", studentIds)
          .eq("status", "active")
          .order("full_name");
  if (studentsResult.error) {
    return { status: "error", missing: missingTable(studentsResult.error) };
  }
  const students = studentsResult.data ?? [];

  const canViewFees = can(staff, "fees.view");
  const [photos, facts] = await Promise.all([
    // A class can run for hours on one screen.
    signedPhotoUrls(supabase, students.map((student) => student.photo_path), 60 * 60 * 4),
    canViewFees
      ? loadStudentFacts(supabase, instituteId, students.map((student) => student.id), true)
      : Promise.resolve(null),
  ]);
  const today = colomboToday();

  return {
    status: "ready",
    page: {
      session: { id: session.id, heldOn: session.held_on, open: session.closed_at === null },
      course: { id: courseResult.data.id, name: courseResult.data.name },
      instituteName: staff.institute.name,
      roster: students.map((student) => {
        const due = facts?.ok ? facts.byStudent.get(student.id)?.nextDue : null;
        return {
          id: student.id,
          fullName: student.full_name,
          code: student.student_code,
          photoUrl: student.photo_path ? (photos.get(student.photo_path) ?? null) : null,
          guardianName: student.guardian_name,
          guardianPhone: student.guardian_phone,
          feesOverdue: Boolean(due && due.date < today),
        };
      }),
      marks: (marksResult.data ?? []).map((mark) => ({
        studentId: mark.student_id,
        scannedAt: mark.scanned_at,
        source: mark.source,
      })),
    },
  };
}

// The attendance tab on a student's page.
export async function loadStudentAttendance(studentId: string): Promise<
  | { status: "error"; missing: boolean }
  | { status: "ready"; courses: CourseAttendance[] }
> {
  const staff = await getStaff();
  if (!staff || !isUuid(studentId)) {
    return { status: "error", missing: false };
  }
  const supabase = await createClient();
  const enrolmentsResult = await supabase
    .from("enrollments")
    .select("course_id, start_date")
    .eq("institute_id", staff.institute.id)
    .eq("student_id", studentId)
    .is("end_date", null);
  if (enrolmentsResult.error) {
    return { status: "error", missing: missingTable(enrolmentsResult.error) };
  }
  const enrolments = enrolmentsResult.data ?? [];
  const courseIds = enrolments.map((row) => row.course_id);
  if (courseIds.length === 0) {
    return { status: "ready", courses: [] };
  }

  // A teacher sees only their own courses (and those courses' sessions); the
  // database leaves the rest out of these queries.
  const [coursesResult, sessionsResult, marksResult] = await Promise.all([
    supabase.from("courses").select("id, name").in("id", courseIds),
    supabase
      .from("class_sessions")
      .select("id, course_id, held_on")
      .in("course_id", courseIds)
      .order("held_on", { ascending: false })
      .limit(1000),
    supabase
      .from("attendance")
      .select("session_id")
      .eq("student_id", studentId)
      .is("voided_at", null)
      .limit(1000),
  ]);
  const firstError = coursesResult.error ?? sessionsResult.error ?? marksResult.error;
  if (firstError) {
    return { status: "error", missing: missingTable(firstError) };
  }
  const names = new Map((coursesResult.data ?? []).map((row) => [row.id, row.name]));

  return {
    status: "ready",
    courses: studentAttendance(
      enrolments
        .filter((row) => names.has(row.course_id))
        .map((row) => ({
          courseId: row.course_id,
          courseName: names.get(row.course_id) ?? "",
          startDate: row.start_date,
        })),
      (sessionsResult.data ?? []).map((row) => ({ id: row.id, courseId: row.course_id, heldOn: row.held_on })),
      new Set((marksResult.data ?? []).map((row) => row.session_id)),
    ),
  };
}

function countBy(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}
