import * as z from "zod";
import { idSchema } from "@/lib/schema";

export const GROUP_TAG_LENGTH = 4;
export const GROUP_NAME_MAX_LENGTH = 30;
export const GROUP_DESCRIPTION_MAX_LENGTH = 200;

export const GROUP_MEMBER_CAP = 50;
export const OWNED_GROUPS_CAP = 1;
export const JOINED_GROUPS_CAP = 5;

// Temporary kill switch for group chat: while polling cost is addressed the
// feature is off. When false, every entry point (chat page, "Open chat" button,
// hub chat icon, unread dots) shows a disabled state and the chat read/poll
// routes + mutations short-circuit. Flip to true to restore it — nothing else
// to change.
export const GROUP_CHAT_ENABLED: boolean = false;

export const GROUP_CHAT_DISABLED_ERROR =
  "Group chat is temporarily unavailable.";

// Fixed group-chat reaction set — same emojis as apps/chat for consistency.
// Gates the picker (UX) AND the react action (server-side validation), so the
// emoji column can never hold arbitrary client content.
export const GROUP_CHAT_REACTION_EMOJIS = [
  "❤️",
  "😂",
  "🔥",
  "😮",
  "👍",
  "😢",
] as const;

export const GROUP_PLUS_REQUIRED_ERROR =
  "Creating a group is an Umamin+ perk — unlocked once your account is a year old.";
// Reserved tags surface as "taken" too — exposing a tag as specifically
// reserved just invites people to probe the blocklist.
export const GROUP_TAG_TAKEN_ERROR = "That tag is taken.";
export const GROUP_FULL_ERROR = "This group is full.";
export const GROUP_OWNED_CAP_ERROR = "You already own a group.";
export const GROUP_JOINED_CAP_ERROR = `You can be in up to ${JOINED_GROUPS_CAP} groups.`;
// Owner-facing variant: the OTHER person is at their joined-groups cap.
export const GROUP_TARGET_CAPPED_ERROR =
  "That person is already in the maximum number of groups.";
export const GROUP_OWNER_CANNOT_LEAVE_ERROR =
  "Group owners can't leave — delete the group instead.";
export const GROUP_USER_NOT_FOUND_ERROR = "We couldn't find that user.";
export const GROUP_CANNOT_INVITE_SELF_ERROR = "You can't invite yourself.";
export const GROUP_ALREADY_MEMBER_ERROR = "Already a member of this group.";
export const GROUP_INVITE_PENDING_ERROR =
  "That person already has a pending invite.";
export const GROUP_REQUEST_PENDING_ERROR = "You've already asked to join.";
export const GROUP_NOT_PENDING_ERROR =
  "There's no pending request to respond to.";
export const GROUP_NOT_MEMBER_ERROR = "You're not a member of this group.";

// Curated allowlist: gates the picker, the server-side schema, and the static
// icon map (lucide has no safe runtime registry; a free-form name would mean
// shipping every icon or rendering nothing).
export const GROUP_ICONS = [
  "anchor",
  "atom",
  "bot",
  "bug",
  "cat",
  "cloud",
  "coffee",
  "crown",
  "dog",
  "flame",
  "gamepad",
  "gem",
  "ghost",
  "glasses",
  "grad-cap",
  "heart",
  "leaf",
  "mic",
  "moon",
  "music",
  "pencil",
  "pizza",
  "rocket",
  "shield",
  "skull",
  "snowflake",
  "sparkles",
  "star",
  "sun",
  "swords",
  "trophy",
  "zap",
] as const;
export type GroupIcon = (typeof GROUP_ICONS)[number];

export const GROUP_ACCENTS = [
  "rose",
  "amber",
  "emerald",
  "sky",
  "violet",
  "pink",
] as const;
export type GroupAccent = (typeof GROUP_ACCENTS)[number];

const GROUP_TAG_PATTERN = /^[A-Za-z0-9]{4}$/;
const GROUP_TAG_FORMAT_ERROR = `Tag must be exactly ${GROUP_TAG_LENGTH} letters or numbers.`;

/** Display form: what's stored in group.tag and rendered in the badge. */
export function formatGroupTag(raw: string): string {
  return raw.trim().toUpperCase();
}

// Leetspeak/lookalike folds (uppercase alphanumeric space). 9 has no
// convincing uppercase double, so it stays itself.
const TAG_FOLDS: Record<string, string> = {
  "0": "O",
  "1": "I",
  "2": "Z",
  "3": "E",
  "4": "A",
  "5": "S",
  "6": "G",
  "7": "T",
  "8": "B",
};

/**
 * Confusable-folded form stored in group.tagNorm — uniqueness and the
 * reserved-list check both run on this, so "M0D5" can't squat next to "MODS".
 */
export function normalizeGroupTag(raw: string): string {
  return formatGroupTag(raw).replace(/[0-8]/g, (d) => TAG_FOLDS[d] ?? d);
}

const groupNameSchema = z
  .string()
  .trim()
  .min(1, { error: "Group name is required." })
  .max(GROUP_NAME_MAX_LENGTH, {
    error: `Group name must not exceed ${GROUP_NAME_MAX_LENGTH} characters.`,
  });

// Optional: the form always sends a string; a blank one normalizes to null so
// the column stays NULL rather than "".
const groupDescriptionSchema = z
  .string()
  .trim()
  .max(GROUP_DESCRIPTION_MAX_LENGTH, {
    error: `Description must not exceed ${GROUP_DESCRIPTION_MAX_LENGTH} characters.`,
  })
  .transform((value) => (value.length > 0 ? value : null));

export const createGroupSchema = z.object({
  name: groupNameSchema,
  description: groupDescriptionSchema,
  tag: z.string().trim().regex(GROUP_TAG_PATTERN, {
    error: GROUP_TAG_FORMAT_ERROR,
  }),
  icon: z.enum(GROUP_ICONS, { error: "Pick an icon from the list." }),
  accent: z
    .enum(GROUP_ACCENTS, { error: "Pick a color from the list." })
    .nullable(),
});

// Tag is intentionally absent: immutable after creation.
export const updateGroupSchema = z.object({
  groupId: idSchema,
  name: groupNameSchema,
  description: groupDescriptionSchema,
  icon: z.enum(GROUP_ICONS, { error: "Pick an icon from the list." }),
  accent: z
    .enum(GROUP_ACCENTS, { error: "Pick a color from the list." })
    .nullable(),
});

export const inviteToGroupSchema = z.object({
  groupId: idSchema,
  username: z.string().trim().min(1).max(20),
});
