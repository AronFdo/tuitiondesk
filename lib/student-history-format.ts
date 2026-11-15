import { leaveReasonLabel, outcomeLabel } from "@/lib/course-history";
import { formatDate } from "@/lib/dates";
import { learningModeLabel, mediumLabel } from "@/lib/student-fields";
import { t } from "@/lib/t";

// Turns activity_log rows about a student (written by supabase/sql/025 and a
// few server actions) into lines the History tab can show.

export type HistoryChange = { label: string; from: string; to: string };

export type HistoryEntry = {
  id: string;
  title: string;
  detail: string | null;
  changes: HistoryChange[];
  actorName: string;
  at: string;
};

export type HistoryRow = {
  id: string;
  action: string;
  data: unknown;
  created_at: string;
  actor_profile_id: string | null;
};

const FIELD_LABELS: Record<string, string> = {
  full_name: "Name",
  date_of_birth: "Date of birth",
  gender: "Gender",
  nic: "NIC",
  id_type: "ID type",
  id_number: "ID number",
  name_on_certificate: "Name on certificate",
  religion: "Religion",
  address: "Address",
  phone: "Phone",
  email: "Email",
  occupation: "Occupation",
  qualification: "Highest qualification",
  school: "School",
  medium: "Medium",
  ol_results: "O/L results",
  al_results: "A/L results",
  guardian_name: "Guardian",
  guardian_phone: "Guardian's phone",
  guardian_occupation: "Guardian's occupation",
  father_name: "Father",
  father_occupation: "Father's occupation",
  mother_name: "Mother",
  mother_occupation: "Mother's occupation",
  emergency_contact_name: "Emergency contact",
  emergency_contact_phone: "Emergency contact phone",
  learning_mode: "Learning mode",
  has_special_needs: "Special needs",
  special_needs: "Special needs details",
  notes: "Notes",
  portal_enabled: "Family portal",
  start_date: "Start date",
  end_date: "End date",
  course_id: "Course",
  outcome: "Outcome",
};

// Matches the order fields appear on the student page.
const FIELD_ORDER = Object.keys(FIELD_LABELS);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function fieldLabel(field: string): string {
  return t(FIELD_LABELS[field] ?? field.replace(/_/g, " "));
}

export function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (typeof value === "boolean") {
    return value ? t("Yes") : t("No");
  }
  const text = String(value);
  if (field === "medium") {
    return t(mediumLabel(text) ?? text);
  }
  if (field === "learning_mode") {
    return t(learningModeLabel(text) ?? text);
  }
  if (field === "outcome") {
    return outcomeLabel(text) ?? text;
  }
  if (field === "gender") {
    return text === "female" ? t("Female") : text === "male" ? t("Male") : text;
  }
  if (field.endsWith("phone") && text.startsWith("+94")) {
    return `0${text.slice(3)}`;
  }
  if (ISO_DATE.test(text)) {
    return formatDate(text);
  }
  return text;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

export function historyChanges(raw: unknown): HistoryChange[] {
  return Object.entries(record(raw))
    .filter(([field]) => field !== "course_id")
    .filter((entry): entry is [string, [unknown, unknown]] => Array.isArray(entry[1]) && entry[1].length === 2)
    .sort(([a], [b]) => {
      const ia = FIELD_ORDER.indexOf(a);
      const ib = FIELD_ORDER.indexOf(b);
      return (ia === -1 ? FIELD_ORDER.length : ia) - (ib === -1 ? FIELD_ORDER.length : ib);
    })
    .map(([field, [from, to]]) => ({
      label: fieldLabel(field),
      from: formatValue(field, from),
      to: formatValue(field, to),
    }));
}

const TITLES: Record<string, string> = {
  student_created: "Added",
  student_updated: "Details changed",
  student_archived: "Archived",
  student_restored: "Restored",
  student_left: "Left the institute",
  student_rejoined: "Rejoined the institute",
  student_photo_changed: "Photo changed",
  student_photo_removed: "Photo removed",
  student_card_reissued: "New card issued",
  enrollment_started: "Joined a course",
  enrollment_ended: "Left a course",
  enrollment_reopened: "Rejoined a course",
  enrollment_updated: "Course dates changed",
  guardian_invited: "Parent invited to the family portal",
  student_document_uploaded: "Document uploaded",
  student_document_deleted: "Document deleted",
};

export function describeHistory(
  row: HistoryRow,
  names: Map<string, string>,
): HistoryEntry {
  const data = record(row.data);
  const course = text(data.course_name);
  let detail: string | null = null;
  if (row.action === "enrollment_started" || row.action === "enrollment_reopened") {
    const start = text(data.start_date);
    detail = [course, start ? `${t("from")} ${formatDate(start)}` : null].filter(Boolean).join(" ");
  } else if (row.action === "enrollment_ended") {
    const end = text(data.end_date);
    const outcome = outcomeLabel(text(data.outcome));
    detail = [
      [course, end ? `${t("on")} ${formatDate(end)}` : null].filter(Boolean).join(" "),
      outcome,
    ]
      .filter(Boolean)
      .join(" · ");
  } else if (row.action === "student_left") {
    const on = text(data.left_on);
    detail = [
      on ? `${t("Last day")} ${formatDate(on)}` : null,
      leaveReasonLabel(text(data.leave_reason)),
      text(data.leave_note),
    ]
      .filter(Boolean)
      .join(" · ");
  } else if (row.action === "enrollment_updated") {
    detail = course;
  } else if (
    row.action === "student_document_uploaded" ||
    row.action === "student_document_deleted"
  ) {
    detail = text(data.file_name);
  } else if (row.action === "guardian_invited") {
    detail = text(data.email);
  } else if (row.action === "student_created") {
    detail = text(data.full_name);
  }

  return {
    id: row.id,
    title: t(TITLES[row.action] ?? row.action.replace(/_/g, " ")),
    detail: detail || null,
    // A course ending or reopening is said in full by the detail line.
    changes:
      row.action === "enrollment_ended" || row.action === "enrollment_reopened"
        ? []
        : historyChanges(data.changes),
    actorName:
      text(data.actor_name) ??
      (row.actor_profile_id ? names.get(row.actor_profile_id) : null) ??
      (row.actor_profile_id ? t("Former staff") : t("System")),
    at: row.created_at,
  };
}
