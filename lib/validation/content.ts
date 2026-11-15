import { z } from "zod";

export const courseFileKindSchema = z.enum(["note", "worksheet"]);

export const inviteParentSchema = z.object({
  studentId: z.uuid(),
  email: z.email("Enter a valid email."),
});

export const courseFileIdSchema = z.object({
  fileId: z.uuid(),
});

export type CourseFileKind = z.infer<typeof courseFileKindSchema>;
export type InviteParentInput = z.infer<typeof inviteParentSchema>;
