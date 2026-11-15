import { z } from "zod";
import { colomboToday } from "@/lib/dates";

export const NOTICE_MAX_LENGTH = 500;

export const noticeSchema = z.object({
  // Empty for a notice to the whole class.
  courseId: z.union([z.literal(""), z.uuid()]),
  body: z
    .string()
    .trim()
    .min(1, "Write the notice.")
    .max(NOTICE_MAX_LENGTH, `Keep the notice under ${NOTICE_MAX_LENGTH} characters.`),
  showUntil: z
    .union([z.literal(""), z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.")])
    .refine((value) => !value || value >= colomboToday(), "Choose today or a later day."),
});

export const noticeIdSchema = z.object({
  noticeId: z.uuid(),
});

export type NoticeInput = z.infer<typeof noticeSchema>;
