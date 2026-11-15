import { z } from "zod";

export const signUpSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name."),
  instituteName: z.string().trim().min(1, "Enter the class name."),
  email: z.email("Enter a valid email."),
  password: z.string().min(8, "Use at least 8 characters."),
});

export const signInSchema = z.object({
  email: z.email("Enter a valid email."),
  password: z.string().min(1, "Enter your password."),
});

export const emailSchema = z.object({
  email: z.email("Enter a valid email."),
});

export const passwordSchema = z.object({
  password: z.string().min(8, "Use at least 8 characters."),
});

export const acceptInviteSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your name."),
  password: z.string().min(8, "Use at least 8 characters."),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type EmailInput = z.infer<typeof emailSchema>;
export type PasswordInput = z.infer<typeof passwordSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
