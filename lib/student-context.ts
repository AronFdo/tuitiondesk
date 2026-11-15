import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCourseFees } from "@/lib/course-fees";
import { nextTuitionDate } from "@/lib/dues";
import type { Database } from "@/lib/supabase/database.types";

export type StudentCourse = {
  id: string;
  name: string;
  tuitionDueDay: number | null;
  monthlyFeeMinor: number;
};

export type LastTuition = {
  courseName: string;
  amountMinor: number;
  paidOn: string;
  periodMonth: string;
};

// The next tuition fee due across the student's courses.
export type NextDue = {
  courseName: string;
  date: string;
  amountMinor: number | null;
};

export type StudentFacts = {
  courses: StudentCourse[];
  lastPaid: LastTuition[] | null;
  nextDue: NextDue | null;
};

type Client = SupabaseClient<Database>;

function missingTable(error: { code?: string; message: string }) {
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    error.code === "PGRST202" ||
    error.message.includes("schema cache")
  );
}

export async function loadStudentFacts(
  supabase: Client,
  instituteId: string,
  studentIds: string[],
  includeFees: boolean,
): Promise<
  | { ok: false; missing: boolean }
  | { ok: true; byStudent: Map<string, StudentFacts> }
> {
  const byStudent = new Map<string, StudentFacts>();
  for (const id of studentIds) {
    byStudent.set(id, { courses: [], lastPaid: null, nextDue: null });
  }
  if (studentIds.length === 0) {
    return { ok: true, byStudent };
  }

  const enrollmentResult = await supabase
    .from("enrollments")
    .select("student_id, course_id, start_date")
    .eq("institute_id", instituteId)
    .in("student_id", studentIds)
    .is("end_date", null);
  if (enrollmentResult.error) {
    return { ok: false, missing: missingTable(enrollmentResult.error) };
  }

  const courseIds = [...new Set((enrollmentResult.data ?? []).map((row) => row.course_id))];
  const courseRows = await loadCourseRows(supabase, courseIds, includeFees);
  if (!courseRows.ok) {
    return courseRows;
  }

  const courses = new Map(
    courseRows.rows.map((course) => [
      course.id,
      {
        id: course.id,
        name: course.name,
        tuitionDueDay: course.tuition_due_day,
        monthlyFeeMinor: course.monthly_fee_minor,
      } satisfies StudentCourse,
    ]),
  );

  const paymentsResult = !includeFees || courseIds.length === 0
    ? { data: [], error: null }
    : await supabase
        .from("tuition_payments")
        .select("student_id, course_id, amount_minor, paid_on, period_month")
        .eq("institute_id", instituteId)
        .in("student_id", studentIds)
        .is("voided_at", null)
        .order("paid_on", { ascending: false });
  if (paymentsResult.error && !missingTable(paymentsResult.error)) {
    return { ok: false, missing: false };
  }
  const feesReady = includeFees && !paymentsResult.error;

  const latestPayment = new Map<
    string,
    { amountMinor: number; paidOn: string; periodMonth: string }
  >();
  for (const payment of paymentsResult.data ?? []) {
    const key = `${payment.student_id}:${payment.course_id}`;
    if (!latestPayment.has(key)) {
      latestPayment.set(key, {
        amountMinor: payment.amount_minor,
        paidOn: payment.paid_on,
        periodMonth: payment.period_month,
      });
    }
  }

  const startDates = new Map(
    (enrollmentResult.data ?? []).map((row) => [
      `${row.student_id}:${row.course_id}`,
      row.start_date,
    ]),
  );
  // The latest month paid, which is not always the most recent payment.
  const paidThrough = new Map<string, string>();
  for (const payment of paymentsResult.data ?? []) {
    const key = `${payment.student_id}:${payment.course_id}`;
    const current = paidThrough.get(key);
    if (!current || payment.period_month > current) {
      paidThrough.set(key, payment.period_month);
    }
  }
  for (const enrollment of enrollmentResult.data ?? []) {
    const course = courses.get(enrollment.course_id);
    if (!course) {
      continue;
    }
    const facts = byStudent.get(enrollment.student_id);
    if (!facts) {
      continue;
    }
    facts.courses.push(course);
  }

  for (const facts of byStudent.values()) {
    facts.courses.sort((a, b) => a.name.localeCompare(b.name));
  }

  if (!feesReady) {
    return { ok: true, byStudent };
  }

  for (const [studentId, facts] of byStudent) {
    const lastPaid: LastTuition[] = [];
    const candidates: NextDue[] = [];
    for (const course of facts.courses) {
      const key = `${studentId}:${course.id}`;
      const payment = latestPayment.get(key);
      if (payment) {
        lastPaid.push({ courseName: course.name, ...payment });
      }
      const startDate = startDates.get(key);
      if (course.tuitionDueDay && startDate) {
        candidates.push({
          courseName: course.name,
          date: nextTuitionDate(
            course.tuitionDueDay,
            paidThrough.get(key) ?? null,
            startDate,
          ),
          amountMinor: course.monthlyFeeMinor > 0 ? course.monthlyFeeMinor : null,
        });
      }
    }
    lastPaid.sort((a, b) => b.paidOn.localeCompare(a.paidOn));
    candidates.sort((a, b) => a.date.localeCompare(b.date));
    facts.lastPaid = lastPaid;
    facts.nextDue = candidates[0] ?? null;
  }

  return { ok: true, byStudent };
}

// Fees come back only when the caller may see them; otherwise every course
// has no fee and no due day.
async function loadCourseRows(
  supabase: Client,
  courseIds: string[],
  includeFees: boolean,
) {
  type Row = {
    id: string;
    name: string;
    tuition_due_day: number | null;
    monthly_fee_minor: number;
  };
  if (courseIds.length === 0) {
    return { ok: true as const, rows: [] as Row[] };
  }

  const [basic, fees] = await Promise.all([
    supabase
      .from("courses")
      .select("id, name")
      .in("id", courseIds)
      .is("archived_at", null),
    includeFees ? loadCourseFees(supabase, courseIds) : null,
  ]);
  if (basic.error) {
    return { ok: false as const, missing: missingTable(basic.error) };
  }
  if (fees && !fees.ok) {
    return { ok: false as const, missing: missingTable(fees.error) };
  }
  return {
    ok: true as const,
    rows: (basic.data ?? []).map((course): Row => {
      const fee = fees?.fees.get(course.id);
      return {
        ...course,
        tuition_due_day: fee?.tuitionDueDay ?? null,
        monthly_fee_minor: fee?.monthlyFeeMinor ?? 0,
      };
    }),
  };
}
