import * as z from "zod";

export const registerSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(5, {
        message: "Username must be at least 5 characters",
      })
      .max(20, {
        message: "Username must not exceed 20 characters",
      })
      .refine((url) => /^[a-zA-Z0-9_-]+$/.test(url), {
        message: "Username must be alphanumeric with no spaces",
      }),
    password: z
      .string()
      .min(5, {
        message: "Password must be at least 5 characters",
      })
      .max(255, {
        message: "Password must not exceed 255 characters",
      }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Password does not match",
    path: ["confirmPassword"],
  });
