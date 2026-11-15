import { z } from "zod";
import { normalizePhone } from "@/lib/phone";
import { parseNic } from "@/lib/student-fields";

// A staff member's details, as the form sends them and as staff_members
// stores them (supabase/sql/028). Empty strings become null.

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => value || null);

const optionalDate = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "Choose a date.")
  .transform((value) => value || null);

export const staffSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, "Enter their name.")
      .max(120, "Keep the name under 120 characters."),
    title: optionalText(80, "Keep the job title under 80 characters."),
    phone: z
      .string()
      .transform((value, ctx) => {
        const result = normalizePhone(value);
        if (!result.ok) {
          ctx.addIssue({ code: "custom", message: "Use 10 digits, like 0771234567." });
          return z.NEVER;
        }
        return result.e164;
      }),
    email: z
      .string()
      .trim()
      .refine((value) => value === "" || z.email().safeParse(value).success, "Enter a valid email.")
      .transform((value) => value.toLowerCase() || null),
    nic: z.string().transform((value, ctx) => {
      const result = parseNic(value);
      if (!result.ok) {
        ctx.addIssue({ code: "custom", message: "Use 9 digits and V or X, or 12 digits." });
        return z.NEVER;
      }
      return result.value || null;
    }),
    address: optionalText(300, "Keep the address under 300 characters."),
    subjects: optionalText(300, "Keep the subjects under 300 characters."),
    joinedOn: optionalDate,
    notes: optionalText(2000, "Keep the notes under 2000 characters."),
  });

export type StaffInput = z.input<typeof staffSchema>;
export type StaffValues = z.output<typeof staffSchema>;

export const emptyStaff: StaffInput = {
  fullName: "",
  title: "",
  phone: "",
  email: "",
  nic: "",
  address: "",
  subjects: "",
  joinedOn: "",
  notes: "",
};

export function staffColumns(values: StaffValues) {
  return {
    full_name: values.fullName,
    title: values.title,
    phone: values.phone,
    email: values.email,
    nic: values.nic,
    address: values.address,
    subjects: values.subjects,
    joined_on: values.joinedOn,
    notes: values.notes,
  };
}

export type StaffRow = {
  full_name: string;
  title: string | null;
  phone: string | null;
  email: string | null;
  nic: string | null;
  address: string | null;
  subjects: string | null;
  joined_on: string | null;
  notes: string | null;
};

export const STAFF_COLUMNS =
  "full_name, title, phone, email, nic, address, subjects, joined_on, notes";

export function staffInput(row: StaffRow): StaffInput {
  return {
    fullName: row.full_name,
    title: row.title ?? "",
    phone: row.phone?.startsWith("+94") ? `0${row.phone.slice(3)}` : (row.phone ?? ""),
    email: row.email ?? "",
    nic: row.nic ?? "",
    address: row.address ?? "",
    subjects: row.subjects ?? "",
    joinedOn: row.joined_on ?? "",
    notes: row.notes ?? "",
  };
}
