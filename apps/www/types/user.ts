import type { SelectAccount, SelectUser } from "@umamin/db/schema/user";
import * as z from "zod";
import type { GroupBadgeData } from "./group";

// lastSeenNotificationsAt is the viewer's own notification watermark,
// blockedWords the viewer's own message filter, and pushPrefs the viewer's own
// push-notification setting — private state, never part of a public (or even
// own-profile) payload. bannerImageUrl is profile-header-only (re-added on
// PublicUserWithBadge), kept out of the per-author payloads that
// publicUserColumns feeds so feed/note/comment lists stay compact.
export type PublicUser = Omit<
  SelectUser,
  | "passwordHash"
  | "lastSeenNotificationsAt"
  | "blockedWords"
  | "bannerImageUrl"
  | "pushPrefs"
>;

// Author shape on badge-rendering surfaces. Optional so optimistic client
// items can omit it (the badge appears on the server swap); null = no badge
// equipped or the group is gone. bannerImageUrl is only selected on the profile
// + current-user reads — undefined on author payloads (and so never rendered).
export type PublicUserWithBadge = PublicUser & {
  groupBadge?: GroupBadgeData | null;
  bannerImageUrl?: string | null;
};

// Lean author shape for LIST surfaces (feed/notes/comments/messages/follow/
// members) — structurally matches feedAuthorColumns in lib/server/data.ts.
// Drops bio/question/follower+followingCount/updatedAt/pinnedPostId that no list
// renderer reads, to cut Fast Origin Transfer. Distinct from PublicUser so the
// compiler rejects any list code that reaches for a dropped field. The full
// PublicUser stays on profile + current-user reads.
export type FeedAuthor = Omit<
  PublicUser,
  | "bio"
  | "question"
  | "followerCount"
  | "followingCount"
  | "updatedAt"
  | "pinnedPostId"
>;

export type FeedAuthorWithBadge = FeedAuthor & {
  groupBadge?: GroupBadgeData | null;
  bannerImageUrl?: string | null;
};

export type CurrentUserClient = PublicUserWithBadge & {
  hasPassword: boolean;
  blockedWords: string[] | null;
  // Push-notification preference bitmask (0 = off). Owner-private — only ever
  // served to the user's own session (mirrors blockedWords/hasPassword).
  pushPrefs: number;
};
export type UserWithAccount = CurrentUserClient & {
  account: SelectAccount | null;
};

export function toPublicUser(user: SelectUser): PublicUser {
  const {
    passwordHash: _passwordHash,
    lastSeenNotificationsAt: _lastSeenNotificationsAt,
    blockedWords: _blockedWords,
    bannerImageUrl: _bannerImageUrl,
    pushPrefs: _pushPrefs,
    ...rest
  } = user;
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
