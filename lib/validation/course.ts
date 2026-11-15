import { z } from "zod";

const courseFields = z.object({
  name: z.string().trim().min(1, "Enter a course name."),
  // The class's own label, such as "Grade 6" or "O/L 2027". Optional.
  level: z.string().trim().max(60, "Keep the level under 60 characters."),
  teacherProfileId: z.string().trim(),
  scheduleDay: z.string().trim().min(1, "Choose a day."),
  scheduleTime: z
    .string()
    .trim()
    .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Choose a time."),
  monthlyFee: z.string().trim(),
  tuitionDueDay: z
    .string()
    .trim()
    .regex(/^(?:[1-9]|[12]\d|3[01])$/, "Choose the day tuition is due."),
  description: z.string().trim(),
});

export const courseSchema = courseFields;

export const courseUpdateSchema = courseFields.extend({ courseId: z.uuid() });

export const courseIdSchema = z.object({
  courseId: z.uuid(),
});

export const studentIdSchema = z.object({
  studentId: z.uuid(),
});

export type CourseInput = z.infer<typeof courseSchema>;
export type CourseUpdateInput = z.infer<typeof courseUpdateSchema>;
