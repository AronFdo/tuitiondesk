import { z } from "zod";

const day = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.");

export const tuitionPaymentSchema = z.object({
  courseId: z.uuid("Choose a course."),
  studentId: z.uuid("Choose a student."),
  amount: z.string().trim().min(1, "Enter the amount."),
  paidOn: day,
  periodMonth: z.string().trim().regex(/^\d{4}-\d{2}$/, "Choose the month."),
});

export const paymentIdSchema = z.object({
  paymentId: z.uuid(),
});

export type TuitionPaymentInput = z.infer<typeof tuitionPaymentSchema>;
