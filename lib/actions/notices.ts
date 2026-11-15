"use server";

import { refresh } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/supabase/session";
import { t } from "@/lib/t";
import { noticeIdSchema, noticeSchema, type NoticeInput } from "@/lib/validation/notices";
import { can } from "@/lib/permissions";

// Notices staff post for parents: to one course, or (admins only) to the whole
// class. Removing one archives it; nothing is deleted.

function firstIssue(message: string | undefined) {
  return t(message ?? "Check the form and try again.");
}

// Admins post anywhere; a teacher only to a course they teach.
async function noticeEditor(courseId: string | null) {
  const staff = await getStaff();
  if (!staff) {
    return { ok: false as const, error: t("Sign in to continue.") };
  }
  const supabase = await createClient();
  if (!courseId) {
    if (!can(staff, "notices.class")) {
      return { ok: false as const, error: t("Only the class owner can post to the whole class.") };
    }
    return { ok: true as const, supabase, staff };
  }
  const { data: course } = await supabase
    .from("courses")
    .select("id, teacher_profile_id")
    .eq("id", courseId)
    .eq("institute_id", staff.institute.id)
    .is("archived_at", null)
    .maybeSingle();
  if (!course) {
    return { ok: false as const, error: t("That course is not in this class.") };
  }
  if (!can(staff, "courses.all") && course.teacher_profile_id !== staff.userId) {
    return {
      ok: false as const,
      error: t("Only the class owner or this course's teacher can do that."),
    };
  }
  return { ok: true as const, supabase, staff };
}

export async function postNotice(input: NoticeInput): Promise<ActionResult> {
  const parsed = noticeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error.issues[0]?.message) };
  }
  const courseId = parsed.data.courseId || null;
  const editor = await noticeEditor(courseId);
  if (!editor.ok) {
    return editor;
  }

  const { data, error } = await editor.supabase
    .from("notices")
    .insert({
      institute_id: editor.staff.institute.id,
      course_id: courseId,
      body: parsed.data.body,
      show_until: parsed.data.showUntil || null,
      created_by: editor.staff.userId,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("postNotice", error?.code, error?.message);
    return { ok: false, error: t("That notice could not be posted.") };
  }

  await editor.supabase.from("activity_log").insert({
    institute_id: editor.staff.institute.id,
    actor_profile_id: editor.staff.userId,
    action: "notice_posted",
    entity: "notices",
    entity_id: data.id,
  });
  refresh();
  return { ok: true, data: undefined };
}

export async function archiveNotice(input: { noticeId: string }): Promise<ActionResult> {
  const parsed = noticeIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: t("That notice could not be removed.") };
  }
  const staff = await getStaff();
  if (!staff) {
    return { ok: false, error: t("Sign in to continue.") };
  }
  const supabase = await createClient();
  const { data: notice } = await supabase
    .from("notices")
    .select("id, course_id")
    .eq("id", parsed.data.noticeId)
    .eq("institute_id", staff.institute.id)
    .is("archived_at", null)
    .maybeSingle();
  if (!notice) {
    return { ok: false, error: t("That notice could not be removed.") };
  }
  const editor = await noticeEditor(notice.course_id);
  if (!editor.ok) {
    return editor;
  }

  const { error } = await editor.supabase
    .from("notices")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", notice.id);
  if (error) {
    console.error("archiveNotice", error.code, error.message);
    return { ok: false, error: t("That notice could not be removed.") };
  }

  await editor.supabase.from("activity_log").insert({
    institute_id: staff.institute.id,
    actor_profile_id: staff.userId,
    action: "notice_archived",
    entity: "notices",
    entity_id: notice.id,
  });
  refresh();
  return { ok: true, data: undefined };
}
