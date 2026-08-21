import type * as z from "zod";
import { type ActionResult, callAction } from "@/lib/api";
import type { MusicAttachment } from "@/lib/music";
import type { UploadContentType } from "@/lib/post-images";
import type { ProTheme } from "@/lib/pro";
import type { generalSettingsSchema, passwordFormSchema } from "@/lib/types";

// Settings mutations aren't in lib/actions.ts — thin typed `callAction`
// wrappers preserving each apps/www action's name + `Out | { error }` shape.

type GeneralInput = z.infer<typeof generalSettingsSchema>;
type PasswordInput = z.infer<typeof passwordFormSchema>;

export function generalSettingsAction(input: GeneralInput) {
  return callAction<{ success: true; user: Partial<GeneralInput> }>(
    "generalSettingsAction",
    input,
  );
}

export function updateProfileMusicAction(input: { musicUrl?: string }) {
  return callAction<{ success: true; music: MusicAttachment | null }>(
    "updateProfileMusicAction",
    input,
  );
}

export function updatePasswordAction(input: PasswordInput) {
  return callAction<{ success: true }>("updatePasswordAction", input);
}

export function toggleQuietModeAction() {
  return callAction<{ quietMode: boolean }>("toggleQuietModeAction");
}

export function updateBlockedWordsAction(input: { words: string[] }) {
  return callAction<{ success: true; blockedWords: string[] }>(
    "updateBlockedWordsAction",
    input,
  );
}

export function unblockUserAction(input: { userId: string }) {
  return callAction<{ success?: boolean }>("unblockUserAction", input);
}

export function updateProfilePhotoAction(input: { key: string }) {
  return callAction<{ success: true; imageUrl: string }>(
    "updateProfilePhotoAction",
    input,
  );
}

export function updateProfileBannerAction(input: { key: string }) {
  return callAction<{ success: true; bannerImageUrl: string }>(
    "updateProfileBannerAction",
    input,
  );
}

export function removeProfilePhotoAction() {
  return callAction<{ success: true }>("removeProfilePhotoAction");
}

export function removeProfileBannerAction() {
  return callAction<{ success: true }>("removeProfileBannerAction");
}

type PresignInput = { contentType: UploadContentType; contentLength: number };
type PresignResult = ActionResult<{ success: true; key: string; url: string }>;

export function presignAvatarUploadAction(
  input: PresignInput,
): Promise<PresignResult> {
  return callAction<{ success: true; key: string; url: string }>(
    "presignAvatarUploadAction",
    input,
  );
}

export function presignBannerUploadAction(
  input: PresignInput,
): Promise<PresignResult> {
  return callAction<{ success: true; key: string; url: string }>(
    "presignBannerUploadAction",
    input,
  );
}

export function updateProfileThemeAction(input: { theme: ProTheme | null }) {
  return callAction<{ success: true; theme: ProTheme | null }>(
    "updateProfileThemeAction",
    input,
  );
}

export function logoutAction() {
  return callAction<{ redirect: string }>("logout");
}

export function deleteAccountAction(confirmation: string) {
  return callAction<{ redirect: string }>("deleteAccount", { confirmation });
}
