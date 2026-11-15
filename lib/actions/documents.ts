"use server";

import { refresh } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { safeFileName } from "@/lib/file-names";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/t";
import { DOCUMENT_KINDS } from "@/lib/document-kinds";
import { z } from "zod";
import { can } from "@/lib/permissions";

// Copies of students' papers. Identity documents of children: admins only,
// in a private bucket.

const documentKindSchema = z.enum(DOCUMENT_KINDS);
const documentIdSchema = z.object({ documentId: z.uuid() });

const maxBytes = 10_485_760;
const bucket = "student-documents";

const mimeByExtension: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  heic: "image/heic",
  heif: "image/heif",
};

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: t("Sign in to continue.") };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("active_institute_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.active_institute_id) {
    return { ok: false as const, error: t("Sign in to continue.") };
  }
  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("profile_id", user.id)
    .eq("institute_id", profile.active_institute_id)
    .maybeSingle();
  if (!can(membership, "students.documents")) {
    return { ok: false as const, error: t("Only the class owner can do that.") };
  }
  return {
    ok: true as const,
    supabase,
    userId: user.id,
    instituteId: profile.active_institute_id,
  };
}

function fileKind(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mime = file.type || mimeByExtension[extension];
  if (!mime || !Object.values(mimeByExtension).includes(mime)) {
    return null;
  }
  return mime;
}

export async function uploadStudentDocument(formData: FormData): Promise<ActionResult> {
  const studentId = String(formData.get("studentId") ?? "");
  const kind = documentKindSchema.safeParse(String(formData.get("kind") ?? ""));
  const file = formData.get("file");
  if (!kind.success) {
    return { ok: false, error: t("Choose what the document is.") };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: t("Choose a file.") };
  }
  if (file.size > maxBytes) {
    return { ok: false, error: t("That file is larger than 10 MB.") };
  }
  const mime = fileKind(file);
  if (!mime) {
    return { ok: false, error: t("Use a PDF or a photo (JPEG, PNG or HEIC).") };
  }
  const uuid = /^[0-9a-f-]{36}$/i;
  if (!uuid.test(studentId)) {
    return { ok: false, error: t("That student is not in this class.") };
  }

  const admin = await requireAdmin();
  if (!admin.ok) {
    return admin;
  }

  const documentId = crypto.randomUUID();
  const storagePath = `${admin.instituteId}/${studentId}/${documentId}-${safeFileName(file.name)}`;
  const uploaded = await admin.supabase.storage
    .from(bucket)
    .upload(storagePath, file, { contentType: mime, upsert: false });
  if (uploaded.error) {
    console.error("uploadStudentDocument storage", uploaded.error.message);
    return { ok: false, error: t("That file could not be saved. Check your connection and try again.") };
  }

  const { error } = await admin.supabase.from("student_documents").insert({
    id: documentId,
    institute_id: admin.instituteId,
    student_id: studentId,
    registration_id: null,
    kind: kind.data,
    file_name: file.name.trim().slice(0, 180) || safeFileName(file.name),
    storage_path: storagePath,
    mime_type: mime,
    size_bytes: file.size,
    uploaded_by: admin.userId,
  });
  if (error) {
    console.error("uploadStudentDocument row", error.code, error.message);
    await admin.supabase.storage.from(bucket).remove([storagePath]);
    return { ok: false, error: t("That file could not be saved. Check your connection and try again.") };
  }

  await admin.supabase.from("activity_log").insert({
    institute_id: admin.instituteId,
    actor_profile_id: admin.userId,
    action: "student_document_uploaded",
    entity: "students",
    entity_id: studentId,
    data: {
      document_id: documentId,
      kind: kind.data,
      file_name: file.name.trim().slice(0, 180) || safeFileName(file.name),
    },
  });
  refresh();
  return { ok: true, data: undefined };
}

export async function deleteStudentDocument(input: {
  documentId: string;
}): Promise<ActionResult> {
  const parsed = documentIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: t("That file could not be deleted. Check your connection and try again.") };
  }
  const admin = await requireAdmin();
  if (!admin.ok) {
    return admin;
  }

  const { data: row } = await admin.supabase
    .from("student_documents")
    .select("id, student_id, storage_path, kind, file_name")
    .eq("id", parsed.data.documentId)
    .eq("institute_id", admin.instituteId)
    .maybeSingle();
  if (!row) {
    return { ok: false, error: t("That file could not be deleted. Check your connection and try again.") };
  }
  const { error } = await admin.supabase.from("student_documents").delete().eq("id", row.id);
  if (error) {
    return { ok: false, error: t("That file could not be deleted. Check your connection and try again.") };
  }
  await admin.supabase.storage.from(bucket).remove([row.storage_path]);
  await admin.supabase.from("activity_log").insert({
    institute_id: admin.instituteId,
    actor_profile_id: admin.userId,
    action: "student_document_deleted",
    entity: "students",
    entity_id: row.student_id,
    data: { document_id: row.id, kind: row.kind, file_name: row.file_name },
  });
  refresh();
  return { ok: true, data: undefined };
}

export async function openStudentDocument(input: {
  documentId: string;
}): Promise<ActionResult<{ url: string }>> {
  const parsed = documentIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: t("That file could not be opened. Check your connection and try again.") };
  }
  const admin = await requireAdmin();
  if (!admin.ok) {
    return admin;
  }

  const { data: row } = await admin.supabase
    .from("student_documents")
    .select("storage_path")
    .eq("id", parsed.data.documentId)
    .eq("institute_id", admin.instituteId)
    .maybeSingle();
  if (!row) {
    return { ok: false, error: t("That file could not be opened. Check your connection and try again.") };
  }
  const signed = await admin.supabase.storage
    .from(bucket)
    .createSignedUrl(row.storage_path, 60 * 10);
  if (signed.error || !signed.data?.signedUrl) {
    return { ok: false, error: t("That file could not be opened. Check your connection and try again.") };
  }
  return { ok: true, data: { url: signed.data.signedUrl } };
}
