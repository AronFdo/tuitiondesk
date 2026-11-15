import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ExistingStudent, ImportCourse } from "@/lib/student-import";

const PAGE = 1000;

// What an import is checked against: the class's open courses, and its active
// students for spotting someone already added.
export async function loadImportContext(
  supabase: SupabaseClient<Database>,
  instituteId: string,
): Promise<
  | { ok: false; error: { code?: string; message: string } }
  | { ok: true; courses: ImportCourse[]; existing: ExistingStudent[] }
> {
  const coursesResult = await supabase
    .from("courses")
    .select("id, name")
    .eq("institute_id", instituteId)
    .is("archived_at", null)
    .order("name");
  if (coursesResult.error) {
    return { ok: false, error: coursesResult.error };
  }

  // The API returns at most 1000 rows at a time.
  const existing: ExistingStudent[] = [];
  for (let from = 0; ; from += PAGE) {
    const page = await supabase
      .from("students")
      .select("full_name, date_of_birth, nic")
      .eq("institute_id", instituteId)
      .eq("status", "active")
      .order("id")
      .range(from, from + PAGE - 1);
    if (page.error) {
      return { ok: false, error: page.error };
    }
    for (const row of page.data ?? []) {
      existing.push({ fullName: row.full_name, dateOfBirth: row.date_of_birth, nic: row.nic });
    }
    if ((page.data ?? []).length < PAGE) {
      break;
    }
  }

  return {
    ok: true,
    courses: (coursesResult.data ?? []).map((course) => ({ id: course.id, name: course.name })),
    existing,
  };
}
