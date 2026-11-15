import { receiptsForPayments } from "@/lib/receipts";
import { STUDENT_COLUMNS, type StudentRow } from "@/lib/student-fields";
import { cardPayload } from "@/lib/student-card";
import { loadStudentFacts, type LastTuition, type NextDue } from "@/lib/student-context";
import { signedPhotoUrls } from "@/lib/student-photos";
import { qrSvg } from "@/lib/qr-svg";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/supabase/session";

export type StudentProfile = {
  canEdit: boolean;
  student: {
    id: string;
    fullName: string;
    code: string;
    photoUrl: string | null;
    cardSvg: string;
    cardIssuedAt: string | null;
    dateOfBirth: string | null;
    gender: string | null;
    guardianName: string | null;
    guardianPhone: string | null;
    notes: string | null;
    // The full record, for the overview.
    details: StudentRow;
  };
  courses: { id: string; name: string; startDate: string | null }[];
  // Fees are for the class owner only; null for teachers.
  lastPaid: LastTuition[] | null;
  nextDue: NextDue | null;
};

export type StudentFees = {
  tuition: {
    id: string;
    courseName: string;
    periodMonth: string;
    amountMinor: number;
    paidOn: string;
    receipt: { id: string; receiptNo: number } | null;
  }[];
};

function missingTable(error: { code?: string; message: string }) {
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    error.code === "42703" ||
    error.message.includes("schema cache")
  );
}

const isUuid = (value: string) => /^[0-9a-f-]{36}$/i.test(value);

// Everything on a student's page header and overview. Teachers can open the
// students on their own courses; the database hides the rest.
export async function loadStudentProfile(studentId: string): Promise<
  | { status: "signed-out" }
  | { status: "not-found" }
  | { status: "error"; missing: boolean }
  | { status: "ready"; profile: StudentProfile }
> {
  const staff = await getStaff();
  if (!staff) {
    return { status: "signed-out" };
  }
  if (!isUuid(studentId)) {
    return { status: "not-found" };
  }

  const supabase = await createClient();
  const instituteId = staff.institute.id;
  const isAdmin = staff.role === "admin";
  const [studentResult, enrollmentsResult] = await Promise.all([
    supabase
      .from("students")
      .select(
        `id, student_code, qr_token, qr_issued_at, photo_path, status, ${STUDENT_COLUMNS}`,
      )
      .eq("id", studentId)
      .eq("institute_id", instituteId)
      .maybeSingle(),
    supabase
      .from("enrollments")
      .select("course_id, start_date")
      .eq("institute_id", instituteId)
      .eq("student_id", studentId)
      .is("end_date", null),
  ]);
  const firstError = studentResult.error ?? enrollmentsResult.error;
  if (firstError) {
    return { status: "error", missing: missingTable(firstError) };
  }
  const student = studentResult.data;
  if (!student || student.status !== "active") {
    return { status: "not-found" };
  }

  const [facts, photos, cardSvg] = await Promise.all([
    loadStudentFacts(supabase, instituteId, [student.id], isAdmin),
    signedPhotoUrls(supabase, [student.photo_path]),
    qrSvg(cardPayload(student.qr_token)),
  ]);
  if (!facts.ok) {
    return { status: "error", missing: facts.missing };
  }
  const detail = facts.byStudent.get(student.id);
  const startDates = new Map(
    (enrollmentsResult.data ?? []).map((row) => [row.course_id, row.start_date]),
  );

  return {
    status: "ready",
    profile: {
      canEdit: isAdmin,
      student: {
        id: student.id,
        fullName: student.full_name,
        code: student.student_code,
        photoUrl: student.photo_path ? (photos.get(student.photo_path) ?? null) : null,
        cardSvg,
        cardIssuedAt: student.qr_issued_at,
        dateOfBirth: student.date_of_birth,
        gender: student.gender,
        guardianName: student.guardian_name,
        guardianPhone: student.guardian_phone,
        notes: student.notes,
        details: student as unknown as StudentRow,
      },
      courses: (detail?.courses ?? []).map((course) => ({
        id: course.id,
        name: course.name,
        startDate: startDates.get(course.id) ?? null,
      })),
      lastPaid: detail?.lastPaid ?? null,
      nextDue: detail?.nextDue ?? null,
    },
  };
}

// Every payment the student has made, newest first. Class owner only.
export async function loadStudentFees(studentId: string): Promise<
  | { status: "forbidden" }
  | { status: "error" }
  | { status: "ready"; fees: StudentFees }
> {
  const staff = await getStaff();
  if (!staff || staff.role !== "admin" || !isUuid(studentId)) {
    return { status: "forbidden" };
  }
  const supabase = await createClient();
  const instituteId = staff.institute.id;
  const tuitionResult = await supabase
    .from("tuition_payments")
    .select("id, course_id, amount_minor, paid_on, period_month")
    .eq("institute_id", instituteId)
    .eq("student_id", studentId)
    .is("voided_at", null)
    .order("paid_on", { ascending: false });
  if (tuitionResult.error) {
    return { status: "error" };
  }

  const tuition = tuitionResult.data ?? [];
  const courseIds = [...new Set(tuition.map((row) => row.course_id))];
  const coursesResult =
    courseIds.length === 0
      ? { data: [], error: null }
      : await supabase.from("courses").select("id, name").in("id", courseIds);
  if (coursesResult.error) {
    return { status: "error" };
  }
  const courseNames = new Map((coursesResult.data ?? []).map((row) => [row.id, row.name]));
  const receipts = await receiptsForPayments(tuition.map((row) => row.id));

  return {
    status: "ready",
    fees: {
      tuition: tuition.map((row) => ({
        id: row.id,
        courseName: courseNames.get(row.course_id) ?? "",
        periodMonth: row.period_month,
        amountMinor: row.amount_minor,
        paidOn: row.paid_on,
        receipt: receipts.get(row.id) ?? null,
      })),
    },
  };
}
