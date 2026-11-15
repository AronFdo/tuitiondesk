"use server";

import { refresh } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { safeFileName } from "@/lib/file-names";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getRequestOrigin } from "@/lib/site";
import { t } from "@/lib/t";
import {
  courseFileIdSchema,
  courseFileKindSchema,
  inviteParentSchema,
  type InviteParentInput,
} from "@/lib/validation/content";
import { can } from "@/lib/permissions";

const maxBytes = 26_214_400;

const mimeByExtension: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

function firstIssue(message: string | undefined) {
  return t(message ?? "Check the form and try again.");
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

async function courseEditor(courseId: string) {
  const session = await signedInClient();
  if (!session.ok) {
    return session;
  }
  const { data: profile } = await session.supabase
    .from("profiles")
    .select("active_institute_id")
    .eq("id", session.userId)
    .maybeSingle();
  if (!profile?.active_institute_id) {
    return { ok: false as const, error: t("Sign in to continue.") };
  }
  const { data: membership } = await session.supabase
    .from("memberships")
    .select("role")
    .eq("profile_id", session.userId)
    .eq("institute_id", profile.active_institute_id)
    .maybeSingle();
  const { data: course } = await session.supabase
    .from("courses")
    .select("id, teacher_profile_id")
    .eq("id", courseId)
    .eq("institute_id", profile.active_institute_id)
    .is("archived_at", null)
    .maybeSingle();
  if (!course) {
    return { ok: false as const, error: t("That course is not in this class.") };
  }
  const allowed =
    can(membership, "courses.all") || course.teacher_profile_id === session.userId;
  if (!allowed) {
    return {
      ok: false as const,
      error: t("Only the class owner or this course's teacher can do that."),
    };
  }
  return {
    ok: true as const,
    supabase: session.supabase,
    userId: session.userId,
    instituteId: profile.active_institute_id,
  };
}

function fileKind(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const fromName = mimeByExtension[extension];
  const mime = file.type || fromName;
  if (!mime || !Object.values(mimeByExtension).includes(mime)) {
    return null;
  }
  return mime;
}

export async function uploadCourseFile(formData: FormData): Promise<ActionResult> {
  const courseId = String(formData.get("courseId") ?? "");
  const kind = courseFileKindSchema.safeParse(String(formData.get("kind") ?? ""));
  const file = formData.get("file");
  if (!kind.success) {
    return { ok: false, error: t("Choose notes or a worksheet.") };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: t("Choose a file.") };
  }
  if (file.size > maxBytes) {
    return { ok: false, error: t("That file is larger than 25 MB.") };
  }
  const mime = fileKind(file);
  if (!mime) {
    return {
      ok: false,
      error: t("Use a PDF, image, Word, or PowerPoint file."),
    };
  }
  if (!/^[0-9a-f-]{36}$/i.test(courseId)) {
    return { ok: false, error: t("That course is not in this class.") };
  }

  const editor = await courseEditor(courseId);
  if (!editor.ok) {
    return editor;
  }

  const fileId = crypto.randomUUID();
  const storagePath = `${editor.instituteId}/${courseId}/${fileId}-${safeFileName(file.name)}`;
  const uploaded = await editor.supabase.storage
    .from("course-files")
    .upload(storagePath, file, { contentType: mime, upsert: false });
  if (uploaded.error) {
    console.error("uploadCourseFile storage", uploaded.error.message);
    return { ok: false, error: t("That file could not be saved.") };
  }

  const { error } = await editor.supabase.from("course_files").insert({
    id: fileId,
    institute_id: editor.instituteId,
    course_id: courseId,
    kind: kind.data,
    file_name: file.name.trim().slice(0, 180) || safeFileName(file.name),
    storage_path: storagePath,
    mime_type: mime,
    size_bytes: file.size,
    uploaded_by: editor.userId,
  });
  if (error) {
    console.error("uploadCourseFile row", error.code, error.message);
    await editor.supabase.storage.from("course-files").remove([storagePath]);
    return { ok: false, error: t("That file could not be saved.") };
  }

  refresh();
  return { ok: true, data: undefined };
}

export async function deleteCourseFile(input: { fileId: string }): Promise<ActionResult> {
  const parsed = courseFileIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: t("That file could not be deleted.") };
  }
  const session = await signedInClient();
  if (!session.ok) {
    return session;
  }

  const { data: row } = await session.supabase
    .from("course_files")
    .select("id, course_id, storage_path, institute_id")
    .eq("id", parsed.data.fileId)
    .maybeSingle();
  if (!row) {
    return { ok: false, error: t("That file could not be deleted.") };
  }
  const { data: profile } = await session.supabase
    .from("profiles")
    .select("active_institute_id")
    .eq("id", session.userId)
    .maybeSingle();
  const { data: membership } = await session.supabase
    .from("memberships")
    .select("role")
    .eq("profile_id", session.userId)
    .eq("institute_id", row.institute_id)
    .maybeSingle();
  const { data: course } = await session.supabase
    .from("courses")
    .select("teacher_profile_id")
    .eq("id", row.course_id)
    .maybeSingle();
  const allowed =
    profile?.active_institute_id === row.institute_id &&
    (can(membership, "courses.all") || course?.teacher_profile_id === session.userId);
  if (!allowed) {
    return {
      ok: false,
      error: t("Only the class owner or this course's teacher can do that."),
    };
  }

  const { error } = await session.supabase.from("course_files").delete().eq("id", row.id);
  if (error) {
    return { ok: false, error: t("That file could not be deleted.") };
  }
  await session.supabase.storage.from("course-files").remove([row.storage_path]);
  refresh();
  return { ok: true, data: undefined };
}

export async function openCourseFile(input: {
  fileId: string;
}): Promise<ActionResult<{ url: string }>> {
  const parsed = courseFileIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: t("That file could not be opened.") };
  }
  const session = await signedInClient();
  if (!session.ok) {
    return session;
  }

  const { data: row } = await session.supabase
    .from("course_files")
    .select("storage_path")
    .eq("id", parsed.data.fileId)
    .maybeSingle();
  if (!row) {
    return { ok: false, error: t("That file could not be opened.") };
  }

  const signed = await session.supabase.storage
    .from("course-files")
    .createSignedUrl(row.storage_path, 60 * 10);
  if (signed.error || !signed.data?.signedUrl) {
    return { ok: false, error: t("That file could not be opened.") };
  }
  return { ok: true, data: { url: signed.data.signedUrl } };
}

export async function inviteParent(input: InviteParentInput): Promise<ActionResult> {
  const parsed = inviteParentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues[0]?.message) };
  }

  const session = await signedInClient();
  if (!session.ok) {
    return session;
  }
  const { data: profile } = await session.supabase
    .from("profiles")
    .select("active_institute_id")
    .eq("id", session.userId)
    .maybeSingle();
  if (!profile?.active_institute_id) {
    return { ok: false, error: t("Sign in to continue.") };
  }
  const { data: membership } = await session.supabase
    .from("memberships")
    .select("role")
    .eq("profile_id", session.userId)
    .eq("institute_id", profile.active_institute_id)
    .maybeSingle();
  if (!can(membership, "parents.invite")) {
    return { ok: false, error: t("Only the class owner can do that.") };
  }

  const { data: student } = await session.supabase
    .from("students")
    .select("id")
    .eq("id", parsed.data.studentId)
    .eq("institute_id", profile.active_institute_id)
    .eq("status", "active")
    .maybeSingle();
  if (!student) {
    return { ok: false, error: t("That student is not in this class.") };
  }

  const adminClient = createAdminClient();
  if (!adminClient.ok) {
    return adminClient;
  }
  const admin = adminClient.client;
  const email = parsed.data.email;

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id, active_institute_id")
    .eq("email", email)
    .maybeSingle();

  let parentId = existingProfile?.id ?? null;
  if (!parentId) {
    const origin = await getRequestOrigin();
    if (!origin) {
      return { ok: false, error: t("Something went wrong. Try again.") };
    }
    const invited = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/accept-invite`,
    });
    if (invited.error || !invited.data.user) {
      return { ok: false, error: t("That invite could not be sent.") };
    }
    parentId = invited.data.user.id;
    const { error: profileError } = await admin.from("profiles").insert({
      id: parentId,
      email,
      full_name: null,
      active_institute_id: profile.active_institute_id,
    });
    if (profileError) {
      return { ok: false, error: t("That invite could not be sent.") };
    }
  }

  const { data: existingMembership } = await admin
    .from("memberships")
    .select("role")
    .eq("profile_id", parentId)
    .eq("institute_id", profile.active_institute_id)
    .maybeSingle();
  if (existingMembership && existingMembership.role !== "parent") {
    return { ok: false, error: t("That email already has an account.") };
  }
  if (!existingMembership) {
    const { error: membershipError } = await admin.from("memberships").insert({
      institute_id: profile.active_institute_id,
      profile_id: parentId,
      role: "parent",
    });
    if (membershipError) {
      return { ok: false, error: t("That invite could not be sent.") };
    }
  }
  if (!existingProfile?.active_institute_id) {
    await admin
      .from("profiles")
      .update({ active_institute_id: profile.active_institute_id })
      .eq("id", parentId);
  }

  const { error: linkError } = await admin.from("guardian_links").insert({
    institute_id: profile.active_institute_id,
    guardian_profile_id: parentId,
    student_id: student.id,
  });
  if (linkError && linkError.code !== "23505") {
    return { ok: false, error: t("That invite could not be sent.") };
  }
  if (!linkError) {
    await session.supabase.from("activity_log").insert({
      institute_id: profile.active_institute_id,
      actor_profile_id: session.userId,
      action: "guardian_invited",
      entity: "students",
      entity_id: student.id,
      data: { email },
    });
  }

  refresh();
  return { ok: true, data: undefined };
}
