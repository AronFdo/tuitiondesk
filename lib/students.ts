import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/supabase/session";
import { signedPhotoUrls } from "@/lib/student-photos";
import { loadStudentFacts, type LastTuition, type NextDue } from "@/lib/student-context";
import { can } from "@/lib/permissions";

export type ClassStudent = {
  id: string;
  fullName: string;
  code: string;
  photoUrl: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  notes: string | null;
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

// The class list, or with left set, the students who have left the institute.
export async function loadStudentsPage({ left = false }: { left?: boolean } = {}): Promise<
  | { status: "signed-out" }
  | { status: "error"; missing: boolean }
  | { status: "ready"; canEdit: boolean; students: ClassStudent[] }
> {
  const staff = await getStaff();
  if (!staff) {
    return { status: "signed-out" };
  }

  const supabase = await createClient();
  const studentsResult = await supabase
    .from("students")
    .select(
      "id, full_name, student_code, photo_path, date_of_birth, gender, guardian_name, guardian_phone, notes",
    )
    .eq("institute_id", staff.institute.id)
    .eq("status", left ? "left" : "active")
    .order("full_name");

  if (studentsResult.error) {
    return { status: "error", missing: missingTable(studentsResult.error) };
  }

  const students = studentsResult.data ?? [];
  const [facts, photos] = await Promise.all([
    loadStudentFacts(
      supabase,
      staff.institute.id,
      students.map((student) => student.id),
      can(staff, "fees.view"),
    ),
    signedPhotoUrls(
      supabase,
      students.map((student) => student.photo_path),
    ),
  ]);
  if (!facts.ok) {
    return { status: "error", missing: facts.missing };
  }

  return {
    status: "ready",
    canEdit: !left && can(staff, "students.manage"),
    students: students.map((student) => {
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
        courses: (detail?.courses ?? []).map((course) => ({
          id: course.id,
          name: course.name,
        })),
        lastPaid: detail?.lastPaid ?? null,
        nextDue: detail?.nextDue ?? null,
      };
    }),
  };
}
