import { z } from "zod";

export const registerSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required."),
  lastName: z.string().trim().min(1, "Last name is required."),
  username: z.string().trim().min(1, "Username is required."),
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .email("Email is invalid."),
  password: z.string().min(1, "Password is required."),
});

export const loginSchema = z.object({
  usernameOrEmail: z
    .string()
    .trim()
    .min(1, "Username or email is required."),
  password: z.string().min(1, "Password is required."),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
