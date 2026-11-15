"use server";

import { refresh, revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { colomboToday } from "@/lib/dates";
import { formatSchedule, isCourseDay } from "@/lib/schedule";
import { parseLkrToMinor } from "@/lib/money";
import { getStaff } from "@/lib/supabase/session";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/t";
import {
  courseIdSchema,
  courseSchema,
  courseUpdateSchema,
  studentIdSchema,
  type CourseInput,
  type CourseUpdateInput,
} from "@/lib/validation/course";
import { can } from "@/lib/permissions";

function firstIssue(message: string | undefined) {
  return t(message ?? "Check the form and try again.");
}

function courseWrite(input: CourseInput) {
  if (!isCourseDay(input.scheduleDay)) {
    return { ok: false as const, error: t("Choose a day.") };
  }
  const fee = parseLkrToMinor(input.monthlyFee);
  if (!fee.ok) {
    return {
      ok: false as const,
      error: t("Enter the monthly fee in rupees, like 12500."),
    };
  }
  return {
    ok: true as const,
    values: {
      name: input.name,
      level: input.level || null,
      teacher_profile_id: input.teacherProfileId || null,
      schedule_text: formatSchedule(input.scheduleDay, input.scheduleTime),
      monthly_fee_minor: fee.minor,
      tuition_due_day: Number(input.tuitionDueDay),
      description: input.description || null,
    },
  };
}

async function signedInClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: t("Sign in to continue.") };
  }
  return { ok: true as const, supabase, userId: user.id };
}

async function requireAdmin() {
  const staff = await getStaff();
  if (!staff) {
    return { ok: false as const, error: t("Sign in to continue.") };
  }
  if (!can(staff, "courses.manage")) {
    return {
      ok: false as const,
      error: t("Only the class owner can do that."),
    };
  }
  return { ok: true as const, staff };
}

export async function createCourse(
  input: CourseInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = courseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues[0]?.message) };
  }

  const admin = await requireAdmin();
  if (!admin.ok) {
    return admin;
  }

  const write = courseWrite(parsed.data);
  if (!write.ok) {
    return write;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .insert({
      institute_id: admin.staff.institute.id,
      ...write.values,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: t("That course could not be saved. Check your connection and try again.") };
  }

  revalidatePath("/dashboard");
  return { ok: true, data: { id: data.id } };
}

export async function updateCourse(
  input: CourseUpdateInput,
): Promise<ActionResult> {
  const parsed = courseUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues[0]?.message) };
  }

  const write = courseWrite(parsed.data);
  if (!write.ok) {
    return write;
  }

  const session = await signedInClient();
  if (!session.ok) {
    return session;
  }
  const supabase = session.supabase;
  const { data, error } = await supabase
    .from("courses")
    .update(write.values)
    .eq("id", parsed.data.courseId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: t("That course could not be saved. Check your connection and try again.") };
  }

  revalidatePath("/dashboard");
  refresh();
  return { ok: true, data: undefined };
}

export async function archiveCourse(input: {
  courseId: string;
}): Promise<ActionResult> {
  const parsed = courseIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: t("That course is not in this class.") };
  }

  const session = await signedInClient();
  if (!session.ok) {
    return session;
  }
  const supabase = session.supabase;
  const existing = await supabase
    .from("courses")
    .select("id, institute_id, archived_at")
    .eq("id", parsed.data.courseId)
    .maybeSingle();

  if (existing.error || !existing.data) {
    return { ok: false, error: t("That course could not be deleted. Check your connection and try again.") };
  }

  if (!existing.data.archived_at) {
    const archived = await supabase
      .from("courses")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", existing.data.id)
      .select("id")
      .maybeSingle();
    if (archived.error || !archived.data) {
      return { ok: false, error: t("That course could not be deleted. Check your connection and try again.") };
    }
  }

  const ended = await supabase
    .from("enrollments")
    .update({ end_date: colomboToday() })
    .eq("course_id", existing.data.id)
    .is("end_date", null);

  if (ended.error) {
    return { ok: false, error: t("That course could not be deleted. Check your connection and try again.") };
  }

  await supabase.from("activity_log").insert({
    institute_id: existing.data.institute_id,
    action: "course_archived",
    entity: "courses",
    entity_id: existing.data.id,
  });

  refresh();
  return { ok: true, data: undefined };
}

export async function archiveStudent(input: {
  studentId: string;
}): Promise<ActionResult> {
  const parsed = studentIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: t("That student is not in this class.") };
  }

  const session = await signedInClient();
  if (!session.ok) {
    return session;
  }
  const supabase = session.supabase;
  const existing = await supabase
    .from("students")
    .select("id, institute_id, status")
    .eq("id", parsed.data.studentId)
    .maybeSingle();

  if (existing.error || !existing.data) {
    return { ok: false, error: t("That student could not be deleted. Check your connection and try again.") };
  }

  if (existing.data.status !== "archived") {
    const archived = await supabase
      .from("students")
      .update({
        status: "archived",
        archived_at: new Date().toISOString(),
      })
      .eq("id", existing.data.id)
      .select("id")
      .maybeSingle();
    if (archived.error || !archived.data) {
      return { ok: false, error: t("That student could not be deleted. Check your connection and try again.") };
    }
  }

  const ended = await supabase
    .from("enrollments")
    .update({ end_date: colomboToday() })
    .eq("student_id", existing.data.id)
    .is("end_date", null);

  if (ended.error) {
    return { ok: false, error: t("That student could not be deleted. Check your connection and try again.") };
  }

  await supabase.from("activity_log").insert({
    institute_id: existing.data.institute_id,
    action: "student_archived",
    entity: "students",
    entity_id: existing.data.id,
  });

  refresh();
  return { ok: true, data: undefined };
}
