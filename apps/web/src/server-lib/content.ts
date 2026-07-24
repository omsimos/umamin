import { customAlphabet } from "nanoid";

// Server-safe subset of apps/www/lib/utils.ts (the DOM/toast/date-fns bits stay
// in the frontend port). Pure string helpers the action layer needs.

export function formatContent(content: string) {
  return content.replace(/(\r\n|\n|\r){2,}/g, "\n\n").trim();
}

export function formatUsername(username: string) {
  const formattedUsername = username.startsWith("%40")
    ? username.split("%40").at(1)
    : username;

  return formattedUsername ?? "";
}

/**
 * Umamin+ — creation perks (polls, group creation) unlocked once an account is
 * over a year old. Mutations re-check this server-side.
 */
export function hasUmaminPlus(createdAt?: Date | string | null) {
  if (!createdAt) return false;

  const createdDate = new Date(createdAt);
  if (Number.isNaN(createdDate.getTime())) return false;

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  return createdDate <= oneYearAgo;
}

const USERNAME_ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export function generateUsernameId(length = 12) {
  return customAlphabet(USERNAME_ID_ALPHABET, length)();
}
