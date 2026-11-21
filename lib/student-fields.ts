import { z } from "zod";
import { colomboToday } from "@/lib/dates";
import { normalizePhone } from "@/lib/phone";

// Everything a student record holds, how each field is checked, and how the
// form, the CSV import and the database name it. The form and the import both
// go through studentSchema, so a value accepted in one is accepted in the other.

export const RELIGIONS = ["Buddhist", "Hindu", "Muslim", "Roman Catholic", "Christian", "Other"] as const;

export const MEDIUMS = [
  { value: "sinhala", label: "Sinhala" },
  { value: "tamil", label: "Tamil" },
  { value: "english", label: "English" },
] as const;

export const LEARNING_MODES = [
  { value: "physical", label: "Physical (in class)" },
  { value: "online", label: "Online" },
] as const;

export type Medium = (typeof MEDIUMS)[number]["value"];
export type LearningMode = (typeof LEARNING_MODES)[number]["value"];

// Old NIC: 9 digits and V or X ("851234567V"). New NIC: 12 digits.
export function parseNic(raw: string): { ok: true; value: string } | { ok: false } {
  const value = raw.replace(/[\s-]/g, "").toUpperCase();
  if (!value) {
    return { ok: true, value: "" };
  }
  return /^(\d{9}[VX]|\d{12})$/.test(value) ? { ok: true, value } : { ok: false };
}

export function parseMedium(raw: string): Medium | "" | null {
  const value = raw.trim().toLowerCase().replace(/\s*medium$/, "");
  if (!value) {
    return "";
  }
  if (["sinhala", "s", "sin"].includes(value)) return "sinhala";
  if (["tamil", "t", "tam"].includes(value)) return "tamil";
  if (["english", "e", "eng"].includes(value)) return "english";
  return null;
}

export function parseLearningMode(raw: string): LearningMode | "" | null {
  const value = raw.trim().toLowerCase();
  if (!value) {
    return "";
  }
  if (["online", "on line", "remote", "zoom"].includes(value)) return "online";
  if (["physical", "in person", "in-person", "class", "in class", "offline"].includes(value)) return "physical";
  return null;
}

export function parseYesNo(raw: string): boolean | null {
  const value = raw.trim().toLowerCase();
  if (["yes", "y", "true", "1"].includes(value)) return true;
  if (["no", "n", "false", "0", ""].includes(value)) return false;
  return null;
}

const text = (max: number, message: string) => z.string().trim().max(max, message);
const optionalPhone = (message: string) =>
  z
    .string()
    .trim()
    .refine((value) => normalizePhone(value).ok, message);

export const studentSchema = z.object({
  firstName: z.string().trim().min(1, "Enter the first name.").max(80, "Keep the first name under 80 characters."),
  lastName: text(80, "Keep the last name under 80 characters."),
  // Kept for every student: the card, the import and the parent portal use them.
  dateOfBirth: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the date of birth.")
    .refine((value) => value >= "1900-01-01" && value <= colomboToday(), "That date of birth is not right."),
  // When they started at the institute. Fees still run from each course's own
  // start, so a date in the past never creates arrears.
  startDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the start date.")
    .refine((value) => value >= "1900-01-01", "That start date is not right."),
  // "" is what the form sends before a choice is made.
  gender: z.enum(["", "female", "male"]).refine((value) => value !== "", "Choose the gender."),
  nic: z
    .string()
    .trim()
    .refine((value) => parseNic(value).ok, "Enter the NIC as 9 digits and V or X, or as 12 digits."),
  religion: text(40, "Keep the religion under 40 characters."),
  address: text(300, "Keep the address under 300 characters."),
  phone: optionalPhone("That phone number looks incomplete. Use 10 digits, like 0771234567."),
  email: z.union([z.literal(""), z.email("Enter an email like name@example.com.")]),
  occupation: text(80, "Keep the occupation under 80 characters."),
  qualification: text(120, "Keep the qualification under 120 characters."),
  school: text(120, "Keep the school name under 120 characters."),
  medium: z.enum(["", "sinhala", "tamil", "english"]),
  olResults: text(1000, "Keep the O/L results under 1000 characters."),
  alResults: text(1000, "Keep the A/L results under 1000 characters."),
  guardianName: text(120, "Keep the guardian's name under 120 characters."),
  guardianPhone: optionalPhone("The guardian's phone looks incomplete. Use 10 digits, like 0771234567."),
  guardianOccupation: text(80, "Keep the guardian's occupation under 80 characters."),
  fatherName: text(120, "Keep the father's name under 120 characters."),
  fatherOccupation: text(80, "Keep the father's occupation under 80 characters."),
  motherName: text(120, "Keep the mother's name under 120 characters."),
  motherOccupation: text(80, "Keep the mother's occupation under 80 characters."),
  emergencyContactName: text(120, "Keep the emergency contact's name under 120 characters."),
  emergencyContactPhone: optionalPhone("The emergency phone looks incomplete. Use 10 digits, like 0771234567."),
  learningMode: z.enum(["", "online", "physical"]),
  hasSpecialNeeds: z.boolean(),
  specialNeeds: text(1000, "Keep the special needs notes under 1000 characters."),
  notes: text(1000, "Keep the notes under 1000 characters."),
});

export type StudentInput = z.input<typeof studentSchema>;
export type StudentValues = z.output<typeof studentSchema>;

export const emptyStudent: StudentInput = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  startDate: "",
  gender: "",
  nic: "",
  religion: "",
  address: "",
  phone: "",
  email: "",
  occupation: "",
  qualification: "",
  school: "",
  medium: "",
  olResults: "",
  alResults: "",
  guardianName: "",
  guardianPhone: "",
  guardianOccupation: "",
  fatherName: "",
  fatherOccupation: "",
  motherName: "",
  motherOccupation: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  learningMode: "",
  hasSpecialNeeds: false,
  specialNeeds: "",
  notes: "",
};

const phone = (value: string) => {
  const result = normalizePhone(value);
  return result.ok ? (result.e164 ?? "") : "";
};

// The database's names, with phones in +94 form and the NIC uppercase. Empty
// strings become null in the database.
export function studentRecord(values: StudentValues) {
  const nic = parseNic(values.nic);
  return {
    first_name: values.firstName,
    last_name: values.lastName,
    date_of_birth: values.dateOfBirth,
    start_date: values.startDate,
    gender: values.gender,
    nic: nic.ok ? nic.value : "",
    religion: values.religion,
    address: values.address,
    phone: phone(values.phone),
    email: values.email.toLowerCase(),
    occupation: values.occupation,
    qualification: values.qualification,
    school: values.school,
    medium: values.medium,
    ol_results: values.olResults,
    al_results: values.alResults,
    guardian_name: values.guardianName,
    guardian_phone: phone(values.guardianPhone),
    guardian_occupation: values.guardianOccupation,
    father_name: values.fatherName,
    father_occupation: values.fatherOccupation,
    mother_name: values.motherName,
    mother_occupation: values.motherOccupation,
    emergency_contact_name: values.emergencyContactName,
    emergency_contact_phone: phone(values.emergencyContactPhone),
    learning_mode: values.learningMode,
    has_special_needs: values.hasSpecialNeeds,
    special_needs: values.hasSpecialNeeds ? values.specialNeeds : "",
    notes: values.notes,
  };
}

export type StudentRecord = ReturnType<typeof studentRecord>;

// The same record for a direct table update: empty strings as null.
export function studentColumns(values: StudentValues) {
  const record = studentRecord(values);
  const columns = Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, value === "" ? null : value]),
  ) as { [K in keyof StudentRecord]: StudentRecord[K] extends string ? string | null : StudentRecord[K] };
  // Required by the schema, and never null in the database.
  return { ...columns, start_date: record.start_date };
}

// A stored student, back into the form's shape.
export type StudentRow = {
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  date_of_birth: string | null;
  start_date: string | null;
  gender: string | null;
  nic: string | null;
  religion: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  occupation: string | null;
  qualification: string | null;
  school: string | null;
  medium: string | null;
  ol_results: string | null;
  al_results: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_occupation: string | null;
  father_name: string | null;
  father_occupation: string | null;
  mother_name: string | null;
  mother_occupation: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  learning_mode: string | null;
  has_special_needs: boolean;
  special_needs: string | null;
  notes: string | null;
};

export const STUDENT_COLUMNS =
  "first_name, last_name, full_name, date_of_birth, start_date, gender, nic, religion, address, phone, email, occupation, qualification, school, medium, ol_results, al_results, guardian_name, guardian_phone, guardian_occupation, father_name, father_occupation, mother_name, mother_occupation, emergency_contact_name, emergency_contact_phone, learning_mode, has_special_needs, special_needs, notes";

// "+94771234567" -> "0771234567", the way people type it.
function localPhone(value: string | null) {
  return value?.startsWith("+94") ? `0${value.slice(3)}` : (value ?? "");
}

export function studentInput(row: StudentRow): StudentInput {
  return {
    firstName: row.first_name ?? row.full_name,
    lastName: row.last_name ?? "",
    dateOfBirth: row.date_of_birth ?? "",
    startDate: row.start_date ?? "",
    gender: row.gender === "female" || row.gender === "male" ? row.gender : "",
    nic: row.nic ?? "",
    religion: row.religion ?? "",
    address: row.address ?? "",
    phone: localPhone(row.phone),
    email: row.email ?? "",
    occupation: row.occupation ?? "",
    qualification: row.qualification ?? "",
    school: row.school ?? "",
    medium: row.medium === "sinhala" || row.medium === "tamil" || row.medium === "english" ? row.medium : "",
    olResults: row.ol_results ?? "",
    alResults: row.al_results ?? "",
    guardianName: row.guardian_name ?? "",
    guardianPhone: localPhone(row.guardian_phone),
    guardianOccupation: row.guardian_occupation ?? "",
    fatherName: row.father_name ?? "",
    fatherOccupation: row.father_occupation ?? "",
    motherName: row.mother_name ?? "",
    motherOccupation: row.mother_occupation ?? "",
    emergencyContactName: row.emergency_contact_name ?? "",
    emergencyContactPhone: localPhone(row.emergency_contact_phone),
    learningMode: row.learning_mode === "online" || row.learning_mode === "physical" ? row.learning_mode : "",
    hasSpecialNeeds: row.has_special_needs,
    specialNeeds: row.special_needs ?? "",
    notes: row.notes ?? "",
  };
}

export function mediumLabel(value: string | null) {
  return MEDIUMS.find((item) => item.value === value)?.label ?? null;
}

export function learningModeLabel(value: string | null) {
  return value === "online" ? "Online" : value === "physical" ? "Physical" : null;
}
