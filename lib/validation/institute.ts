import { z } from "zod";

export const instituteSchema = z.object({
  name: z.string().trim().min(1, "Enter the class name."),
  phone: z.string(),
  address: z.string(),
  timezone: z.string().trim().min(1, "Enter a timezone, like Asia/Colombo."),
});

const dueDay = (message: string) =>
  z.string().trim().regex(/^(?:[1-9]|[12]\d|3[01])$/, message);

export const dueDaysSchema = z.object({
  tuitionDueDay: dueDay("Choose the day tuition fees are due."),
});

export type InstituteInput = z.infer<typeof instituteSchema>;
export type DueDaysInput = z.infer<typeof dueDaysSchema>;
