"use server";

import { refresh } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { colomboToday } from "@/lib/dates";
import { parseCardPayload } from "@/lib/student-card";
import { createClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/supabase/session";
import { t } from "@/lib/t";

const uuid = /^[0-9a-f-]{36}$/i;
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

export type ScanStatus = "marked" | "already" | "unknown_card" | "not_enrolled" | "archived" | "closed";

export type ScanOutcome = {
  status: ScanStatus;
  studentId: string | null;
  fullName: string | null;
  code: string | null;
};

async function staffClient() {
  const staff = await getStaff();
  if (!staff) {
    return { ok: false as const, error: t("Sign in to continue.") };
  }
  return { ok: true as const, staff, supabase: await createClient() };
}

function notAllowed(message: string | undefined) {
  return message?.includes("not allowed") ?? false;
}

export async function openSession(input: {
  courseId: string;
  heldOn: string;
}): Promise<ActionResult<{ sessionId: string }>> {
  if (!uuid.test(input.courseId)) {
    return { ok: false, error: t("Choose a class.") };
  }
  if (!isoDate.test(input.heldOn) || input.heldOn > colomboToday()) {
    return { ok: false, error: t("Choose today or a day before.") };
  }
  const session = await staffClient();
  if (!session.ok) {
    return session;
  }
  const { data, error } = await session.supabase.rpc("open_class_session", {
    p_course_id: input.courseId,
    p_held_on: input.heldOn,
  });
  if (error || !data) {
    console.error("openSession", error?.code, error?.message);
    return {
      ok: false,
      error: notAllowed(error?.message)
        ? t("You can take attendance only for the classes you teach.")
        : error?.message.includes("bad date")
          ? t("Choose a day within the last year.")
          : t("Attendance could not be started. Check your connection and try again."),
    };
  }
  return { ok: true, data: { sessionId: data } };
}

// One scanned card. Fast path: no refresh, the scan screen updates itself.
export async function recordScan(input: {
  sessionId: string;
  scanned: string;
  source: "scanner" | "camera";
  scannedAt: string;
}): Promise<ActionResult<ScanOutcome>> {
  const token = parseCardPayload(input.scanned);
  if (!uuid.test(input.sessionId) || (input.source !== "scanner" && input.source !== "camera")) {
    return { ok: false, error: t("That scan could not be saved. Check your connection and try again.") };
  }
  if (!token) {
    return { ok: true, data: { status: "unknown_card", studentId: null, fullName: null, code: null } };
  }
  const scannedAt = Number.isNaN(Date.parse(input.scannedAt)) ? new Date().toISOString() : input.scannedAt;

  const session = await staffClient();
  if (!session.ok) {
    return session;
  }
  const { data, error } = await session.supabase.rpc("record_scan", {
    p_session_id: input.sessionId,
    p_token: token,
    p_source: input.source,
    p_scanned_at: scannedAt,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    console.error("recordScan", error?.code, error?.message);
    return { ok: false, error: t("That scan could not be saved. Check your connection and try again.") };
  }
  const result = data as Record<string, unknown>;
  return {
    ok: true,
    data: {
      status: result.status as ScanStatus,
      studentId: typeof result.student_id === "string" ? result.student_id : null,
      fullName: typeof result.full_name === "string" ? result.full_name : null,
      code: typeof result.student_code === "string" ? result.student_code : null,
    },
  };
}

export async function setAttendance(input: {
  sessionId: string;
  studentId: string;
  present: boolean;
}): Promise<ActionResult> {
  if (!uuid.test(input.sessionId) || !uuid.test(input.studentId) || typeof input.present !== "boolean") {
    return { ok: false, error: t("That change could not be saved. Check your connection and try again.") };
  }
  const session = await staffClient();
  if (!session.ok) {
    return session;
  }
  const { error } = await session.supabase.rpc("set_attendance", {
    p_session_id: input.sessionId,
    p_student_id: input.studentId,
    p_present: input.present,
  });
  if (error) {
    console.error("setAttendance", error.code, error.message);
    return { ok: false, error: t("That change could not be saved. Check your connection and try again.") };
  }
  return { ok: true, data: undefined };
}

export async function closeSession(input: { sessionId: string }): Promise<ActionResult> {
  if (!uuid.test(input.sessionId)) {
    return { ok: false, error: t("That session could not be closed. Check your connection and try again.") };
  }
  const session = await staffClient();
  if (!session.ok) {
    return session;
  }
  const { error } = await session.supabase.rpc("close_class_session", { p_session_id: input.sessionId });
  if (error) {
    console.error("closeSession", error.code, error.message);
    return { ok: false, error: t("That session could not be closed. Check your connection and try again.") };
  }
  refresh();
  return { ok: true, data: undefined };
}
