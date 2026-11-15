import { receiptsForPayments } from "@/lib/receipts";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/supabase/session";

export type CourseOption = {
  id: string;
  name: string;
  monthlyFeeMinor: number;
};

export type EnrolledStudent = {
  id: string;
  courseId: string;
  fullName: string;
};

export type TuitionPaymentItem = {
  id: string;
  studentId: string;
  studentName: string;
  courseName: string;
  amountMinor: number;
  paidOn: string;
  periodMonth: string;
  // null for a payment whose receipt has not been issued (before 021 ran).
  receipt: { id: string; receiptNo: number } | null;
};

// A missing table, or a column the latest SQL adds, means the SQL has not run.
export function missingTable(error: { code?: string; message: string }) {
  return (
    error.code === "PGRST205" ||
    error.code === "PGRST204" ||
    error.code === "42P01" ||
    error.code === "42703" ||
    error.message.includes("schema cache")
  );
}

export async function loadPaymentsPage(): Promise<
  | { status: "signed-out" }
  | { status: "error"; missing: boolean }
  | { status: "forbidden" }
  | {
      status: "ready";
      courses: CourseOption[];
      students: EnrolledStudent[];
      tuition: TuitionPaymentItem[];
    }
> {
  const staff = await getStaff();
  if (!staff) {
    return { status: "signed-out" };
  }
  if (staff.role !== "admin") {
    return { status: "forbidden" };
  }

  const supabase = await createClient();
  const instituteId = staff.institute.id;
  const [coursesResult, enrollmentsResult, tuitionResult] = await Promise.all([
    supabase
      .from("courses")
      .select("id, name, monthly_fee_minor")
      .eq("institute_id", instituteId)
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("enrollments")
      .select("course_id, student_id")
      .eq("institute_id", instituteId)
      .is("end_date", null),
    supabase
      .from("tuition_payments")
      .select("id, course_id, student_id, amount_minor, paid_on, period_month")
      .eq("institute_id", instituteId)
      .is("voided_at", null)
      .order("paid_on", { ascending: false }),
  ]);

  const firstError = coursesResult.error ?? enrollmentsResult.error ?? tuitionResult.error;
  if (firstError) {
    return { status: "error", missing: missingTable(firstError) };
  }

  const courses = coursesResult.data ?? [];
  const courseNames = new Map(courses.map((course) => [course.id, course.name]));
  const studentIds = [
    ...new Set([
      ...(enrollmentsResult.data ?? []).map((row) => row.student_id),
      ...(tuitionResult.data ?? []).map((row) => row.student_id),
    ]),
  ];
  const studentsResult =
    studentIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("students")
          .select("id, full_name")
          .in("id", studentIds)
          .eq("status", "active");
  if (studentsResult.error) {
    return { status: "error", missing: missingTable(studentsResult.error) };
  }

  const receipts = await receiptsForPayments((tuitionResult.data ?? []).map((row) => row.id));
  const studentNames = new Map(
    (studentsResult.data ?? []).map((student) => [student.id, student.full_name]),
  );

  return {
    status: "ready",
    courses: courses.map((course) => ({
      id: course.id,
      name: course.name,
      monthlyFeeMinor: course.monthly_fee_minor,
    })),
    students: (enrollmentsResult.data ?? [])
      .filter((row) => studentNames.has(row.student_id) && courseNames.has(row.course_id))
      .map((row) => ({
        id: row.student_id,
        courseId: row.course_id,
        fullName: studentNames.get(row.student_id) ?? "",
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    tuition: (tuitionResult.data ?? [])
      .filter((row) => studentNames.has(row.student_id) && courseNames.has(row.course_id))
      .map((row) => ({
        id: row.id,
        studentId: row.student_id,
        studentName: studentNames.get(row.student_id) ?? "",
        courseName: courseNames.get(row.course_id) ?? "",
        amountMinor: row.amount_minor,
        paidOn: row.paid_on,
        periodMonth: row.period_month,
        receipt: receipts.get(row.id) ?? null,
      })),
  };
}
