import * as z from "zod";
import { MAX_MESSAGE_LENGTH } from "./constants";

// Shared micro-schema for single-id action args.
export const idSchema = z.string().min(1);

export const sendMessageSchema = z.object({
  orgId: idSchema,
  content: z
    .string()
    .trim()
    .min(1, { error: "Message cannot be empty" })
    .max(MAX_MESSAGE_LENGTH, {
      error: `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`,
    }),
});

export const passwordFormSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, { error: "Enter your current password" }),
    newPassword: z
      .string()
      .min(10, { error: "Password must be at least 10 characters" })
      .max(255, { error: "Password must not exceed 255 characters" }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    error: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const updateProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .max(50, { error: "Name must not exceed 50 characters" })
    .optional(),
  question: z
    .string()
    .trim()
    .min(1, { error: "Prompt cannot be empty" })
    .max(150, { error: "Prompt must not exceed 150 characters" }),
  acceptingMessages: z.boolean(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type PasswordFormInput = z.infer<typeof passwordFormSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
