import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCourseFees } from "@/lib/course-fees";
import { colomboToday } from "@/lib/dates";
import {
  buildReminders,
  tuitionOwed,
  type Reminder,
  type ReminderCourse,
  type TuitionOwed,
} from "@/lib/family-reminders";
import { signedLogoUrl } from "@/lib/institute-logo";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { getParent, getStaff, type ParentContext } from "@/lib/supabase/session";

// The parent portal. Every query runs as the parent, so row security limits
// it to the children linked to them; the checks here are for clear errors,
// not for safety.

type Client = SupabaseClient<Database>;

export type FamilyFile = {
  id: string;
  name: string;
  kind: "note" | "worksheet";
  sizeBytes: number;
};

export type FamilyNotice = {
  id: string;
  body: string;
  // Null for a notice to the whole class.
  courseName: string | null;
  postedOn: string;
  isNew: boolean;
};

export type FamilyCourse = {
  id: string;
  name: string;
  notices: FamilyNotice[];
  notes: FamilyFile[];
  worksheets: FamilyFile[];
};

export type FamilyTuition = {
  courseId: string;
  courseName: string;
  monthlyFeeMinor: number;
  owed: TuitionOwed | null;
  overdue: boolean;
};

export type FamilyPayment = {
  id: string;
  courseName: string;
  amountMinor: number;
  paidOn: string;
  // The month a tuition payment is for.
  periodMonth: string | null;
};

export type FamilyChildSummary = { id: string; fullName: string };

export type FamilyFrame = {
  instituteName: string;
  logoUrl: string | null;
  children: FamilyChildSummary[];
};

type Failure =
  | { status: "signed-out" }
  | { status: "staff" }
  | { status: "error"; missing: boolean }
  | { status: "not-found" };

function missingTable(error: { code?: string; message: string }) {
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    error.code === "42703" ||
    error.message.includes("schema cache")
  );
}

function failed(error: { code?: string; message: string }): Failure {
  return { status: "error", missing: missingTable(error) };
}

async function parentOrFailure(): Promise<
  { ok: true; parent: ParentContext } | { ok: false; failure: Failure }
> {
  const parent = await getParent();
  if (parent) {
    return { ok: true, parent };
  }
  const staff = await getStaff();
  return { ok: false, failure: staff ? { status: "staff" } : { status: "signed-out" } };
}

async function linkedChildren(
  supabase: Client,
  parent: ParentContext,
): Promise<{ ok: true; children: FamilyChildSummary[] } | { ok: false; failure: Failure }> {
  const links = await supabase
    .from("guardian_links")
    .select("student_id")
    .eq("guardian_profile_id", parent.userId)
    .eq("institute_id", parent.institute.id);
  if (links.error) {
    return { ok: false, failure: failed(links.error) };
  }
  const studentIds = (links.data ?? []).map((link) => link.student_id);
  if (studentIds.length === 0) {
    return { ok: true, children: [] };
  }
  const students = await supabase
    .from("students")
    .select("id, full_name")
    .in("id", studentIds)
    .eq("status", "active")
    .order("full_name");
  if (students.error) {
    return { ok: false, failure: failed(students.error) };
  }
  return {
    ok: true,
    children: (students.data ?? []).map((student) => ({
      id: student.id,
      fullName: student.full_name,
    })),
  };
}

// The portal frame: the class and the parent's children.
export async function loadFamilyFrame(): Promise<Failure | ({ status: "ready" } & FamilyFrame)> {
  const found = await parentOrFailure();
  if (!found.ok) {
    return found.failure;
  }
  const supabase = await createClient();
  const [children, logoUrl] = await Promise.all([
    linkedChildren(supabase, found.parent),
    signedLogoUrl(found.parent.institute.logo_path),
  ]);
  if (!children.ok) {
    return children.failure;
  }
  return {
    status: "ready",
    instituteName: found.parent.institute.name,
    logoUrl,
    children: children.children,
  };
}

type ChildContext = {
  supabase: Client;
  parent: ParentContext;
  child: FamilyChildSummary;
  today: string;
};

async function childContext(
  childId: string,
): Promise<{ ok: true; context: ChildContext } | { ok: false; failure: Failure }> {
  const found = await parentOrFailure();
  if (!found.ok) {
    return found;
  }
  const supabase = await createClient();
  const children = await linkedChildren(supabase, found.parent);
  if (!children.ok) {
    return children;
  }
  const child = children.children.find((item) => item.id === childId);
  if (!child) {
    return { ok: false, failure: { status: "not-found" } };
  }
  return {
    ok: true,
    context: { supabase, parent: found.parent, child, today: colomboToday() },
  };
}

type CourseRow = {
  id: string;
  name: string;
  tuition_due_day: number | null;
  monthly_fee_minor: number;
  startDate: string;
};

// The courses the child is on now, with when they joined each.
async function childCourses(
  context: ChildContext,
): Promise<{ ok: true; courses: CourseRow[] } | { ok: false; failure: Failure }> {
  const { supabase, child, parent } = context;
  const enrollments = await supabase
    .from("enrollments")
    .select("course_id, start_date")
    .eq("institute_id", parent.institute.id)
    .eq("student_id", child.id)
    .is("end_date", null);
  if (enrollments.error) {
    return { ok: false, failure: failed(enrollments.error) };
  }
  const starts = new Map((enrollments.data ?? []).map((row) => [row.course_id, row.start_date]));
  if (starts.size === 0) {
    return { ok: true, courses: [] };
  }
  const courses = await supabase
    .from("courses")
    .select("id, name")
    .in("id", [...starts.keys()])
    .is("archived_at", null)
    .order("name");
  if (courses.error) {
    return { ok: false, failure: failed(courses.error) };
  }
  const fees = await loadCourseFees(supabase, [...starts.keys()]);
  if (!fees.ok) {
    return { ok: false, failure: failed(fees.error) };
  }
  return {
    ok: true,
    courses: (courses.data ?? []).map((course) => ({
      ...course,
      tuition_due_day: fees.fees.get(course.id)?.tuitionDueDay ?? null,
      monthly_fee_minor: fees.fees.get(course.id)?.monthlyFeeMinor ?? 0,
      startDate: starts.get(course.id) ?? context.today,
    })),
  };
}

type TuitionPaymentRow = {
  id: string;
  course_id: string;
  amount_minor: number;
  paid_on: string;
  period_month: string;
};

async function childTuitionPayments(
  context: ChildContext,
): Promise<{ ok: true; payments: TuitionPaymentRow[] } | { ok: false; failure: Failure }> {
  const { supabase, child, parent } = context;
  const payments = await supabase
    .from("tuition_payments")
    .select("id, course_id, amount_minor, paid_on, period_month")
    .eq("institute_id", parent.institute.id)
    .eq("student_id", child.id)
    .is("voided_at", null)
    .order("paid_on", { ascending: false });
  if (payments.error) {
    return { ok: false, failure: failed(payments.error) };
  }
  return { ok: true, payments: payments.data ?? [] };
}

function reminderCourses(courses: CourseRow[], payments: TuitionPaymentRow[]): ReminderCourse[] {
  return courses.map((course) => {
    const paidThrough = payments
      .filter((payment) => payment.course_id === course.id)
      .reduce<string | null>(
        (latest, payment) => (!latest || payment.period_month > latest ? payment.period_month : latest),
        null,
      );
    return {
      id: course.id,
      name: course.name,
      tuitionDueDay: course.tuition_due_day,
      monthlyFeeMinor: course.monthly_fee_minor,
      startDate: course.startDate,
      paidThrough,
    };
  });
}

// Notices for the whole class and for the child's courses that are still up.
async function childNotices(
  context: ChildContext,
  courses: CourseRow[],
  since: string | null,
): Promise<
  | { ok: true; notices: (FamilyNotice & { courseId: string | null })[] }
  | { ok: false; failure: Failure }
> {
  const { supabase, parent, today } = context;
  const courseIds = courses.map((course) => course.id);
  const scope =
    courseIds.length === 0
      ? "course_id.is.null"
      : `course_id.is.null,course_id.in.(${courseIds.join(",")})`;
  const notices = await supabase
    .from("notices")
    .select("id, course_id, body, created_at, show_until")
    .eq("institute_id", parent.institute.id)
    .is("archived_at", null)
    .or(scope)
    .order("created_at", { ascending: false })
    .limit(50);
  if (notices.error) {
    return { ok: false, failure: failed(notices.error) };
  }
  const names = new Map(courses.map((course) => [course.id, course.name]));
  return {
    ok: true,
    // Past their last day, notices drop off.
    notices: (notices.data ?? [])
      .filter((notice) => notice.show_until === null || notice.show_until >= today)
      .map((notice) => ({
        id: notice.id,
        courseId: notice.course_id,
        body: notice.body,
        courseName: notice.course_id ? (names.get(notice.course_id) ?? null) : null,
        postedOn: notice.created_at.slice(0, 10),
        isNew: since !== null && notice.created_at > since,
      })),
  };
}

export type FamilyHome = {
  child: FamilyChildSummary;
  reminders: Reminder[];
  notices: FamilyNotice[];
  newFiles: (FamilyFile & { courseName: string })[];
};

export async function loadFamilyHome(
  childId: string,
): Promise<Failure | ({ status: "ready" } & FamilyHome)> {
  const found = await childContext(childId);
  if (!found.ok) {
    return found.failure;
  }
  const context = found.context;
  const { supabase, child, today } = context;

  // Marks this visit; what was posted since the one before counts as new.
  const seen = await supabase.rpc("touch_last_seen");
  const since = seen.error ? null : seen.data;

  const [coursesResult, paymentsResult] = await Promise.all([
    childCourses(context),
    childTuitionPayments(context),
  ]);
  if (!coursesResult.ok) {
    return coursesResult.failure;
  }
  if (!paymentsResult.ok) {
    return paymentsResult.failure;
  }
  const courses = coursesResult.courses;
  const courseById = new Map(courses.map((course) => [course.id, course]));

  const [noticesResult, filesResult] = await Promise.all([
    childNotices(context, courses, since),
    since === null || courses.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from("course_files")
          .select("id, course_id, kind, file_name, size_bytes")
          .in(
            "course_id",
            courses.map((course) => course.id),
          )
          .gt("created_at", since)
          .order("created_at", { ascending: false })
          .limit(3),
  ]);
  if (!noticesResult.ok) {
    return noticesResult.failure;
  }
  if (filesResult.error) {
    return failed(filesResult.error);
  }

  return {
    status: "ready",
    child,
    reminders: buildReminders(reminderCourses(courses, paymentsResult.payments), today),
    notices: noticesResult.notices.slice(0, 5),
    newFiles: (filesResult.data ?? []).flatMap((file) =>
      file.kind === "note" || file.kind === "worksheet"
        ? [
            {
              id: file.id,
              name: file.file_name,
              kind: file.kind,
              sizeBytes: file.size_bytes,
              courseName: courseById.get(file.course_id)?.name ?? "",
            },
          ]
        : [],
    ),
  };
}

export async function loadFamilyCourses(
  childId: string,
): Promise<Failure | { status: "ready"; child: FamilyChildSummary; courses: FamilyCourse[] }> {
  const found = await childContext(childId);
  if (!found.ok) {
    return found.failure;
  }
  const context = found.context;
  const coursesResult = await childCourses(context);
  if (!coursesResult.ok) {
    return coursesResult.failure;
  }
  const courses = coursesResult.courses;
  const courseIds = courses.map((course) => course.id);
  const [filesResult, noticesResult] = await Promise.all([
    courseIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : context.supabase
          .from("course_files")
          .select("id, course_id, kind, file_name, size_bytes")
          .in("course_id", courseIds)
          .order("file_name"),
    childNotices(context, courses, null),
  ]);
  if (filesResult.error) {
    return failed(filesResult.error);
  }
  if (!noticesResult.ok) {
    return noticesResult.failure;
  }

  return {
    status: "ready",
    child: context.child,
    courses: courses.map((course) => {
      const files = (filesResult.data ?? []).flatMap((file): FamilyFile[] =>
        file.course_id === course.id && (file.kind === "note" || file.kind === "worksheet")
          ? [{ id: file.id, name: file.file_name, kind: file.kind, sizeBytes: file.size_bytes }]
          : [],
      );
      return {
        id: course.id,
        name: course.name,
        notices: noticesResult.notices.filter((notice) => notice.courseId === course.id),
        notes: files.filter((file) => file.kind === "note"),
        worksheets: files.filter((file) => file.kind === "worksheet"),
      };
    }),
  };
}

export async function loadFamilyFees(childId: string): Promise<
  | Failure
  | {
      status: "ready";
      child: FamilyChildSummary;
      tuition: FamilyTuition[];
      payments: FamilyPayment[];
    }
> {
  const found = await childContext(childId);
  if (!found.ok) {
    return found.failure;
  }
  const context = found.context;
  const [coursesResult, paymentsResult] = await Promise.all([
    childCourses(context),
    childTuitionPayments(context),
  ]);
  if (!coursesResult.ok) {
    return coursesResult.failure;
  }
  if (!paymentsResult.ok) {
    return paymentsResult.failure;
  }
  const courses = coursesResult.courses;
  const courseById = new Map(courses.map((course) => [course.id, course]));
  const today = context.today;

  const tuition = reminderCourses(courses, paymentsResult.payments).flatMap((course) => {
    if (!course.tuitionDueDay || course.monthlyFeeMinor <= 0) {
      return [];
    }
    const owed = tuitionOwed(course, today);
    return [
      {
        courseId: course.id,
        courseName: course.name,
        monthlyFeeMinor: course.monthlyFeeMinor,
        owed,
        overdue: owed !== null && owed.dueOn < today,
      },
    ];
  });

  const courseName = (courseId: string) => courseById.get(courseId)?.name ?? "";
  const payments: FamilyPayment[] = paymentsResult.payments
    .map((payment) => ({
      id: payment.id,
      courseName: courseName(payment.course_id),
      amountMinor: payment.amount_minor,
      paidOn: payment.paid_on,
      periodMonth: payment.period_month,
    }))
    .sort((a, b) => b.paidOn.localeCompare(a.paidOn));

  return { status: "ready", child: context.child, tuition, payments };
}
