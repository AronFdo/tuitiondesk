import { COURSE_COLUMNS, courseForm, loadTeacherOptions, type TeacherOption } from "@/lib/class-courses";
import { loadStudentFacts, type LastTuition, type NextDue } from "@/lib/student-context";
import { createClient } from "@/lib/supabase/server";
import { getStaff, type StaffContext } from "@/lib/supabase/session";
import { signedPhotoUrls } from "@/lib/student-photos";
import type { CourseInput } from "@/lib/validation/course";

export type CourseStudent = {
  id: string;
  fullName: string;
  code: string;
  photoUrl: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  notes: string | null;
  startDate: string;
  courses: { id: string; name: string }[];
  lastPaid: LastTuition[] | null;
  nextDue: NextDue | null;
};

function missingTable(error: { code?: string; message: string }) {
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    error.code === "42703" ||
    error.message.includes("schema cache")
  );
}

export async function loadCourse(courseId: string): Promise<
  | { status: "signed-out" }
  | { status: "error"; missing: boolean }
  | { status: "missing" }
  | {
      status: "ready";
      staff: StaffContext;
      course: {
        id: string;
        name: string;
        level: string | null;
        scheduleText: string | null;
        monthlyFeeMinor: number;
        tuitionDueDay: number | null;
        description: string | null;
        form: CourseInput;
      };
      teachers: TeacherOption[];
      students: CourseStudent[];
      filesReady: boolean;
      notes: { id: string; name: string; sizeBytes: number }[];
      worksheets: { id: string; name: string; sizeBytes: number }[];
    }
> {
  const staff = await getStaff();
  if (!staff) {
    return { status: "signed-out" };
  }
  if (!/^[0-9a-f-]{36}$/i.test(courseId)) {
    return { status: "missing" };
  }

  const supabase = await createClient();
  const courseResult = await supabase
    .from("courses")
    .select(COURSE_COLUMNS)
    .eq("id", courseId)
    .eq("institute_id", staff.institute.id)
    .is("archived_at", null)
    .maybeSingle();

  if (courseResult.error) {
    return { status: "error", missing: missingTable(courseResult.error) };
  }
  const course = courseResult.data;
  if (
    !course ||
    (staff.role === "teacher" && course.teacher_profile_id !== staff.userId)
  ) {
    return { status: "missing" };
  }

  const isAdmin = staff.role === "admin";
  const [enrollmentResult, filesResult, teachers] = await Promise.all([
    supabase
      .from("enrollments")
      .select("student_id, start_date")
      .eq("course_id", course.id)
      .is("end_date", null),
    supabase
      .from("course_files")
      .select("id, kind, file_name, size_bytes")
      .eq("course_id", course.id)
      .order("file_name"),
    isAdmin ? loadTeacherOptions(staff.institute.id) : Promise.resolve([]),
  ]);

  if (enrollmentResult.error) {
    return { status: "error", missing: missingTable(enrollmentResult.error) };
  }
  const filesMissing = Boolean(filesResult.error && missingTable(filesResult.error));
  const courseFiles = filesMissing ? [] : (filesResult.data ?? []);
  if (filesResult.error && !filesMissing) {
    return { status: "error", missing: false };
  }
  const notes = courseFiles
    .filter((file) => file.kind === "note")
    .map((file) => ({ id: file.id, name: file.file_name, sizeBytes: file.size_bytes }));
  const worksheets = courseFiles
    .filter((file) => file.kind === "worksheet")
    .map((file) => ({ id: file.id, name: file.file_name, sizeBytes: file.size_bytes }));

  const studentIds = (enrollmentResult.data ?? []).map((row) => row.student_id);
  const studentsResult =
    studentIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("students")
          .select(
            "id, full_name, student_code, photo_path, date_of_birth, gender, guardian_name, guardian_phone, notes",
          )
          .in("id", studentIds);

  if (studentsResult.error) {
    return { status: "error", missing: missingTable(studentsResult.error) };
  }

  const starts = new Map(
    (enrollmentResult.data ?? []).map((row) => [row.student_id, row.start_date]),
  );
  const [facts, photos] = await Promise.all([
    loadStudentFacts(
      supabase,
      staff.institute.id,
      (studentsResult.data ?? []).map((student) => student.id),
      isAdmin,
    ),
    signedPhotoUrls(
      supabase,
      (studentsResult.data ?? []).map((student) => student.photo_path),
    ),
  ]);
  if (!facts.ok) {
    return { status: "error", missing: facts.missing };
  }

  const students = (studentsResult.data ?? [])
    .map((student) => {
      const detail = facts.byStudent.get(student.id);
      return {
        id: student.id,
        fullName: student.full_name,
        code: student.student_code,
        photoUrl: student.photo_path ? (photos.get(student.photo_path) ?? null) : null,
        dateOfBirth: student.date_of_birth,
        gender: student.gender,
        guardianName: student.guardian_name,
        guardianPhone: student.guardian_phone,
        notes: student.notes,
        startDate: starts.get(student.id) ?? "",
        courses: (detail?.courses ?? []).map((course) => ({
          id: course.id,
          name: course.name,
        })),
        lastPaid: detail?.lastPaid ?? null,
        nextDue: detail?.nextDue ?? null,
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  return {
    status: "ready",
    staff,
    teachers,
    course: {
      id: course.id,
      name: course.name,
      level: course.level,
      scheduleText: course.schedule_text,
      monthlyFeeMinor: course.monthly_fee_minor,
      tuitionDueDay: course.tuition_due_day,
      description: course.description,
      form: courseForm(course),
    },
    students,
    filesReady: !filesMissing,
    notes,
    worksheets,
  };
}
