import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/supabase/session";
import type { DocumentKind, StudentDocument } from "@/lib/document-kinds";

// Copies of a student's papers, kept in a private bucket only the class owner
// can read.

export async function loadStudentDocuments(studentId: string): Promise<
  { status: "forbidden" } | { status: "error" } | { status: "ready"; documents: StudentDocument[] }
> {
  const staff = await getStaff();
  if (!staff || staff.role !== "admin" || !/^[0-9a-f-]{36}$/i.test(studentId)) {
    return { status: "forbidden" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("student_documents")
    .select("id, kind, file_name")
    .eq("institute_id", staff.institute.id)
    .eq("student_id", studentId)
    .order("created_at");
  if (error) {
    return { status: "error" };
  }
  return {
    status: "ready",
    documents: (data ?? []).map((row) => ({
      id: row.id,
      kind: row.kind as DocumentKind,
      fileName: row.file_name,
    })),
  };
}
