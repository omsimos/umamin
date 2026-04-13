import type { SelectAccount, SelectUser } from "@umamin/db/schema/user";
import * as z from "zod";

export type PublicUser = Omit<SelectUser, "passwordHash">;
export type CurrentUserClient = PublicUser & { hasPassword: boolean };
export type UserWithAccount = CurrentUserClient & {
  account: SelectAccount | null;
};

export function toPublicUser(user: SelectUser): PublicUser {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

export const generalSettingsSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, { error: "Custom message must be at least 1 character." })
    .max(150, {
      error: "Custom message must not be longer than 150 characters.",
    }),
  bio: z
    .string()
    .trim()
    .max(150, { error: "Bio must not be longer than 150 characters." }),
  displayName: z
    .string()
    .trim()
    .max(20, { error: "Display name must not exceed 20 characters." }),
  username: z
    .string()
    .trim()
    .min(5, { error: "Username must be at least 5 characters." })
    .max(20, { error: "Username must not exceed 20 characters." })
    .refine((v) => /^[a-zA-Z0-9_-]+$/.test(v), {
      error: "Username must be alphanumeric with no spaces.",
    }),
});

const passwordSchema = z
  .string()
  .min(10, { error: "Password must be at least 10 characters" })
  .max(128, { error: "Password must not exceed 128 characters" });

export const passwordFormSchema = z
  .object({
    currentPassword: z.string(),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
