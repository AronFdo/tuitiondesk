import { loadCourseFees } from "@/lib/course-fees";
import { colomboToday, previousMonth } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { getStaff, type StaffContext } from "@/lib/supabase/session";

export type ClassSummary = {
  staff: StaffContext;
  students: number;
  courses: number;
  withoutCourse: number;
  // Last month's tuition still unpaid (paid in arrears). null for teachers,
  // or when payments are not set up yet.
  expectedFeesMinor: number | null;
  expectedMonth: string;
  // Students marked here in today's classes, and how many classes took
  // attendance. null before the attendance SQL has run.
  today: { present: number; sessions: number } | null;
  // null for teachers, or when payments are not set up yet.
  overdueMinor: number | null;
  collectedThisMonthMinor: number | null;
};

function missingTable(error: { code?: string; message: string }) {
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    error.code === "PGRST202" ||
    error.code === "42883" ||
    error.message.includes("schema cache")
  );
}

export async function loadDashboard(): Promise<
  | { status: "signed-out" }
  | { status: "missing"; staff: StaffContext }
  | { status: "error"; staff: StaffContext }
  | { status: "ready"; summary: ClassSummary }
> {
  const staff = await getStaff();
  if (!staff) {
    return { status: "signed-out" };
  }

  const supabase = await createClient();
  const [studentsResult, coursesResult, enrollmentsResult] = await Promise.all([
    supabase
      .from("students")
      .select("id")
      .eq("institute_id", staff.institute.id)
      .eq("status", "active"),
    supabase
      .from("courses")
      .select("id, name")
      .eq("institute_id", staff.institute.id)
      .is("archived_at", null),
    supabase
      .from("enrollments")
      .select("student_id, course_id, start_date")
      .eq("institute_id", staff.institute.id)
      .is("end_date", null),
  ]);

  const today = colomboToday();
  const monthStart = `${today.slice(0, 7)}-01`;
  const lastMonthStart = `${previousMonth(today)}-01`;
  const canViewFees = can(staff, "fees.view");
  const [overdueResult, tuitionResult, lastMonthPaidResult, sessionsResult] =
    await Promise.all([
    canViewFees ? supabase.rpc("overdue_tuition_minor", { p_today: today }) : null,
    canViewFees
      ? supabase
          .from("tuition_payments")
          .select("amount_minor")
          .eq("institute_id", staff.institute.id)
          .is("voided_at", null)
          .gte("paid_on", monthStart)
      : null,
    canViewFees
      ? supabase
          .from("tuition_payments")
          .select("student_id, course_id, amount_minor")
          .eq("institute_id", staff.institute.id)
          .is("voided_at", null)
          .eq("period_month", lastMonthStart)
      : null,
    // A teacher sees only their own classes' sessions.
    supabase
      .from("class_sessions")
      .select("id")
      .eq("institute_id", staff.institute.id)
      .eq("held_on", today),
  ]);

  const firstError =
    studentsResult.error ?? coursesResult.error ?? enrollmentsResult.error;
  if (firstError) {
    return {
      status: missingTable(firstError) ? "missing" : "error",
      staff,
    };
  }

  const studentIds = new Set((studentsResult.data ?? []).map((row) => row.id));
  const enrolledIds = new Set(
    (enrollmentsResult.data ?? []).map((row) => row.student_id),
  );
  let withoutCourse = 0;
  for (const id of studentIds) {
    if (!enrolledIds.has(id)) {
      withoutCourse += 1;
    }
  }

  const courseFees = canViewFees
    ? await loadCourseFees(
        supabase,
        (coursesResult.data ?? []).map((course) => course.id),
      )
    : null;
  const fees = new Map<string, number>();
  if (courseFees?.ok) {
    for (const [id, fee] of courseFees.fees) {
      fees.set(id, fee.monthlyFeeMinor);
    }
  }
  // Tuition is paid in arrears, so what is expected now is last month's fee
  // for each enrollment that had started by then, less what was paid for it.
  let expectedFeesMinor: number | null = null;
  // Without fees the total would read as zero, so it stays unknown.
  if (courseFees?.ok && lastMonthPaidResult && !lastMonthPaidResult.error) {
    const paid = new Map<string, number>();
    for (const row of lastMonthPaidResult.data ?? []) {
      const key = `${row.student_id}:${row.course_id}`;
      paid.set(key, (paid.get(key) ?? 0) + row.amount_minor);
    }
    expectedFeesMinor = 0;
    for (const enrollment of enrollmentsResult.data ?? []) {
      if (
        !studentIds.has(enrollment.student_id) ||
        enrollment.start_date >= monthStart
      ) {
        continue;
      }
      const fee = fees.get(enrollment.course_id) ?? 0;
      const key = `${enrollment.student_id}:${enrollment.course_id}`;
      expectedFeesMinor += Math.max(fee - (paid.get(key) ?? 0), 0);
    }
  }

  const optionalError = [
    overdueResult,
    tuitionResult,
    lastMonthPaidResult,
    sessionsResult,
  ]
    .map((result) => result?.error)
    .find((error) => error && !missingTable(error));
  if (optionalError) {
    return { status: "error", staff };
  }

  let todaySummary: ClassSummary["today"] = null;
  if (!sessionsResult.error) {
    const sessionIds = (sessionsResult.data ?? []).map((row) => row.id);
    const marks =
      sessionIds.length === 0
        ? { data: [], error: null }
        : await supabase
            .from("attendance")
            .select("student_id")
            .in("session_id", sessionIds)
            .is("voided_at", null);
    if (!marks.error) {
      todaySummary = {
        present: new Set((marks.data ?? []).map((row) => row.student_id)).size,
        sessions: sessionIds.length,
      };
    }
  }

  const overdueMinor =
    overdueResult && !overdueResult.error ? Number(overdueResult.data) : null;
  const collectedThisMonthMinor =
    tuitionResult && !tuitionResult.error
      ? (tuitionResult.data ?? []).reduce(
          (sum, row) => sum + row.amount_minor,
          0,
        )
      : null;

  return {
    status: "ready",
    summary: {
      staff,
      students: studentIds.size,
      courses: coursesResult.data?.length ?? 0,
      withoutCourse,
      expectedFeesMinor,
      expectedMonth: lastMonthStart,
      today: todaySummary,
      overdueMinor,
      collectedThisMonthMinor,
    },
  };
}
