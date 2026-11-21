"use server";

import { refresh } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { isCourseOutcome, isLeaveReason } from "@/lib/course-history";
import { colomboToday } from "@/lib/dates";
import { newCardToken } from "@/lib/student-card";
import { studentColumns, studentRecord, studentSchema, type StudentInput } from "@/lib/student-fields";
import { loadImportContext } from "@/lib/student-import-context";
import { importableRows, readStudentSheet, rowsToImport } from "@/lib/student-import";
import { PHOTO_BUCKET } from "@/lib/student-photos";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/supabase/session";
import { t } from "@/lib/t";
import { can } from "@/lib/permissions";

const uuid = /^[0-9a-f-]{36}$/i;
const photoTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const maxPhotoBytes = 2_097_152;
// About 1000 rows of a full spreadsheet.
const maxCsvChars = 1_000_000;

async function requireAdmin() {
  const staff = await getStaff();
  if (!staff) {
    return { ok: false as const, error: t("Sign in to continue.") };
  }
  if (!can(staff, "students.manage")) {
    return { ok: false as const, error: t("Only the class owner can do that.") };
  }
  return { ok: true as const, staff, supabase: await createClient() };
}

async function logActivity(
  admin: Extract<Awaited<ReturnType<typeof requireAdmin>>, { ok: true }>,
  action: string,
  entityId: string,
) {
  await admin.supabase.from("activity_log").insert({
    institute_id: admin.staff.institute.id,
    actor_profile_id: admin.staff.userId,
    action,
    entity: "students",
    entity_id: entityId,
    data: { actor_name: admin.staff.fullName },
  });
}

// The browser crops and shrinks the photo before it is sent, so what arrives
// is a small square image.
export async function uploadStudentPhoto(formData: FormData): Promise<ActionResult> {
  const studentId = String(formData.get("studentId") ?? "");
  const file = formData.get("photo");
  if (!uuid.test(studentId)) {
    return { ok: false, error: t("That student is not in this class.") };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: t("Choose a photo.") };
  }
  const extension = photoTypes[file.type];
  if (!extension) {
    return { ok: false, error: t("Use a JPEG, PNG or WebP photo.") };
  }
  if (file.size > maxPhotoBytes) {
    return { ok: false, error: t("That photo is larger than 2 MB.") };
  }

  const admin = await requireAdmin();
  if (!admin.ok) {
    return admin;
  }
  const instituteId = admin.staff.institute.id;
  const { data: student } = await admin.supabase
    .from("students")
    .select("id, photo_path")
    .eq("id", studentId)
    .eq("institute_id", instituteId)
    .maybeSingle();
  if (!student) {
    return { ok: false, error: t("That student is not in this class.") };
  }

  const path = `${instituteId}/${studentId}/${crypto.randomUUID()}.${extension}`;
  const uploaded = await admin.supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploaded.error) {
    console.error("uploadStudentPhoto storage", uploaded.error.message);
    return { ok: false, error: t("That photo could not be saved. Check your connection and try again.") };
  }

  const { error } = await admin.supabase
    .from("students")
    .update({ photo_path: path })
    .eq("id", studentId)
    .eq("institute_id", instituteId);
  if (error) {
    console.error("uploadStudentPhoto row", error.code, error.message);
    await admin.supabase.storage.from(PHOTO_BUCKET).remove([path]);
    return { ok: false, error: t("That photo could not be saved. Check your connection and try again.") };
  }
  if (student.photo_path) {
    await admin.supabase.storage.from(PHOTO_BUCKET).remove([student.photo_path]);
  }
  await logActivity(admin, "student_photo_changed", studentId);
  refresh();
  return { ok: true, data: undefined };
}

export async function removeStudentPhoto(input: { studentId: string }): Promise<ActionResult> {
  if (!uuid.test(input.studentId)) {
    return { ok: false, error: t("That student is not in this class.") };
  }
  const admin = await requireAdmin();
  if (!admin.ok) {
    return admin;
  }
  const { data: student } = await admin.supabase
    .from("students")
    .select("id, photo_path")
    .eq("id", input.studentId)
    .eq("institute_id", admin.staff.institute.id)
    .maybeSingle();
  if (!student) {
    return { ok: false, error: t("That student is not in this class.") };
  }
  if (!student.photo_path) {
    return { ok: true, data: undefined };
  }
  const { error } = await admin.supabase
    .from("students")
    .update({ photo_path: null })
    .eq("id", student.id);
  if (error) {
    return { ok: false, error: t("That photo could not be removed. Check your connection and try again.") };
  }
  await admin.supabase.storage.from(PHOTO_BUCKET).remove([student.photo_path]);
  await logActivity(admin, "student_photo_removed", student.id);
  refresh();
  return { ok: true, data: undefined };
}

// A lost card: a new token, so the old card's QR code no longer works.
export async function reissueStudentCard(input: { studentId: string }): Promise<ActionResult> {
  if (!uuid.test(input.studentId)) {
    return { ok: false, error: t("That student is not in this class.") };
  }
  const admin = await requireAdmin();
  if (!admin.ok) {
    return admin;
  }
  const { data, error } = await admin.supabase
    .from("students")
    .update({ qr_token: newCardToken(), qr_issued_at: new Date().toISOString() })
    .eq("id", input.studentId)
    .eq("institute_id", admin.staff.institute.id)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    console.error("reissueStudentCard", error?.code, error?.message);
    return { ok: false, error: t("A new card could not be made. Check your connection and try again.") };
  }
  await logActivity(admin, "student_card_reissued", data.id);
  refresh();
  return { ok: true, data: undefined };
}

// The server reads the file again with its own list of courses and students,
// so the preview in the browser cannot be used to slip anything past it.
export async function importStudents(input: {
  csv: string;
  defaultCourseId: string;
  includeDuplicates: boolean;
}): Promise<
  ActionResult<{ added: number; skipped: number; students: { line: number; studentId: string }[] }>
> {
  if (typeof input.csv !== "string" || input.csv.length === 0) {
    return { ok: false, error: t("Choose a CSV file.") };
  }
  if (input.csv.length > maxCsvChars) {
    return { ok: false, error: t("That file is too large. Bring in up to 1000 students at a time.") };
  }
  if (input.defaultCourseId && !uuid.test(input.defaultCourseId)) {
    return { ok: false, error: t("Choose a course from the list.") };
  }

  const admin = await requireAdmin();
  if (!admin.ok) {
    return admin;
  }
  const context = await loadImportContext(admin.supabase, admin.staff.institute.id);
  if (!context.ok) {
    return { ok: false, error: t("Students could not be loaded. Refresh the page to try again.") };
  }
  if (input.defaultCourseId && !context.courses.some((course) => course.id === input.defaultCourseId)) {
    return { ok: false, error: t("Choose a course from the list.") };
  }

  const sheet = readStudentSheet(input.csv, {
    courses: context.courses,
    existing: context.existing,
    today: colomboToday(),
    defaultCourseId: input.defaultCourseId || null,
  });
  if (!sheet.ok) {
    return { ok: false, error: t(sheet.error) };
  }
  const withProblems = sheet.rows.filter((row) => row.errors.length > 0).length;
  if (withProblems > 0) {
    return {
      ok: false,
      error: t(`Fix the ${withProblems === 1 ? "row" : `${withProblems} rows`} with problems, then upload the file again.`),
    };
  }
  const rows = rowsToImport(sheet.rows, input.includeDuplicates);
  const lines = importableRows(sheet.rows, input.includeDuplicates).map((row) => row.line);
  if (rows.length === 0) {
    return { ok: false, error: t("Every student in that file is already here.") };
  }

  const { data, error } = await admin.supabase.rpc("import_students", {
    p_rows: rows,
    p_start_date: colomboToday(),
  });
  if (error) {
    console.error("importStudents", error.code, error.message);
    return { ok: false, error: t("Those students could not be added. Nothing was saved. Check your connection and try again.") };
  }
  // Each new student's id beside the CSV row it came from, so the photos
  // chosen with the file can be attached to the right student.
  const ids = Array.isArray(data) ? data.filter((id): id is string => typeof id === "string") : [];
  refresh();
  return {
    ok: true,
    data: {
      added: rows.length,
      skipped: sheet.rows.length - rows.length,
      students: ids.length === lines.length ? lines.map((line, index) => ({ line, studentId: ids[index] })) : [],
    },
  };
}

function studentError(error: { code?: string; message: string } | null, fallback: string) {
  if (error?.code === "23505" && error.message.includes("nic")) {
    return t("Another student in this class already has that NIC. Check the number, or open that student instead.");
  }
  if (error?.code === "42703" || error?.code === "PGRST204" || error?.code === "PGRST202") {
    return t("Student details are not up to date. Run the SQL files in supabase/sql up to 030_student_start_date.sql in Supabase, then try again.");
  }
  if (error?.message.includes("course not found")) {
    return t("One of those courses was deleted. Refresh the page and choose again.");
  }
  return t(fallback);
}

// Add a student with their full record, on any number of courses.
export async function createStudent(input: {
  student: StudentInput;
  courseIds: string[];
}): Promise<ActionResult<{ studentId: string }>> {
  const parsed = studentSchema.safeParse(input.student);
  if (!parsed.success) {
    return { ok: false, error: t(parsed.error.issues[0]?.message ?? "Check the form and try again.") };
  }
  if (!Array.isArray(input.courseIds) || input.courseIds.some((id) => !uuid.test(id))) {
    return { ok: false, error: t("Choose courses from the list.") };
  }
  const admin = await requireAdmin();
  if (!admin.ok) {
    return admin;
  }
  const { data, error } = await admin.supabase.rpc("create_student", {
    p_data: studentRecord(parsed.data),
    p_course_ids: [...new Set(input.courseIds)],
    p_start_date: colomboToday(),
  });
  if (error || typeof data !== "string") {
    console.error("createStudent", error?.code, error?.message);
    return { ok: false, error: studentError(error, "That student could not be added. Check your connection and try again.") };
  }
  // The database logs the new student and their courses (025).
  refresh();
  return { ok: true, data: { studentId: data } };
}

// Save a student's record and, when courseIds is given, the courses they are
// on: unticked courses end today, with the outcome given for each, and newly
// ticked ones start today.
export async function updateStudentDetails(input: {
  studentId: string;
  student: StudentInput;
  courseIds?: string[];
  outcomes?: Record<string, string>;
}): Promise<ActionResult> {
  if (!uuid.test(input.studentId)) {
    return { ok: false, error: t("That student is not in this class.") };
  }
  if (input.courseIds && !input.courseIds.every((id) => uuid.test(id))) {
    return { ok: false, error: t("One of those courses was deleted. Refresh the page and choose again.") };
  }
  const outcomes = Object.fromEntries(
    Object.entries(input.outcomes ?? {}).filter(
      ([courseId, outcome]) => uuid.test(courseId) && isCourseOutcome(outcome),
    ),
  );
  const parsed = studentSchema.safeParse(input.student);
  if (!parsed.success) {
    return { ok: false, error: t(parsed.error.issues[0]?.message ?? "Check the form and try again.") };
  }
  const admin = await requireAdmin();
  if (!admin.ok) {
    return admin;
  }
  const { data, error } = await admin.supabase
    .from("students")
    .update(studentColumns(parsed.data))
    .eq("id", input.studentId)
    .eq("institute_id", admin.staff.institute.id)
    .eq("status", "active")
    .select("id")
    .maybeSingle();
  if (error || !data) {
    console.error("updateStudentDetails", error?.code, error?.message);
    return { ok: false, error: studentError(error, "That student could not be saved. Check your connection and try again.") };
  }
  if (input.courseIds) {
    const courses = await admin.supabase.rpc("set_student_courses", {
      p_student_id: data.id,
      p_course_ids: [...new Set(input.courseIds)],
      p_on: colomboToday(),
      p_outcomes: outcomes,
    });
    if (courses.error) {
      console.error("updateStudentDetails courses", courses.error.code, courses.error.message);
      refresh();
      return {
        ok: false,
        error: courses.error.code === "PGRST202"
          ? t("The details were saved, but changing courses is not set up yet. Run 027_course_history.sql in Supabase, then try again.")
          : courses.error.message.includes("course not found")
            ? t("The details were saved, but one of those courses was deleted. Refresh the page and choose again.")
            : t("The details were saved, but the courses could not be changed. Try again."),
      };
    }
  }
  // The database logs what changed, field by field, and each course start
  // and end (025).
  refresh();
  return { ok: true, data: undefined };
}

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

// The student leaves the institute: every open course ends on that date and
// they move off the class lists, but their record and history stay.
export async function markStudentLeft(input: {
  studentId: string;
  leftOn: string;
  reason: string;
  note: string;
}): Promise<ActionResult> {
  if (!uuid.test(input.studentId)) {
    return { ok: false, error: t("That student is not in this class.") };
  }
  if (!isoDate.test(input.leftOn) || input.leftOn > colomboToday()) {
    return { ok: false, error: t("Choose the day they left. It cannot be in the future.") };
  }
  if (input.reason && !isLeaveReason(input.reason)) {
    return { ok: false, error: t("Choose a reason from the list.") };
  }
  const note = input.note.trim();
  if (note.length > 500) {
    return { ok: false, error: t("Keep the note under 500 characters.") };
  }
  const admin = await requireAdmin();
  if (!admin.ok) {
    return admin;
  }
  const { error } = await admin.supabase.rpc("mark_student_left", {
    p_student_id: input.studentId,
    p_left_on: input.leftOn,
    p_reason: input.reason || null,
    p_note: note || null,
  });
  if (error) {
    console.error("markStudentLeft", error.code, error.message);
    return {
      ok: false,
      error: error.code === "PGRST202"
        ? t("Leaving is not set up yet. Run 027_course_history.sql in Supabase, then try again.")
        : error.message.includes("student not found")
          ? t("That student has already left or is not in this class. Refresh the page.")
          : t("That could not be saved. Check your connection and try again."),
    };
  }
  refresh();
  return { ok: true, data: undefined };
}

// Back on the class lists. Their old courses stay in their history; new ones
// are added from the edit page.
export async function rejoinStudent(input: { studentId: string }): Promise<ActionResult> {
  if (!uuid.test(input.studentId)) {
    return { ok: false, error: t("That student is not in this class.") };
  }
  const admin = await requireAdmin();
  if (!admin.ok) {
    return admin;
  }
  const { error } = await admin.supabase.rpc("rejoin_student", { p_student_id: input.studentId });
  if (error) {
    console.error("rejoinStudent", error.code, error.message);
    return { ok: false, error: t("That could not be saved. Check your connection and try again.") };
  }
  refresh();
  return { ok: true, data: undefined };
}
