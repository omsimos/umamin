import { customAlphabet } from "nanoid";
import { hasUmaminPro } from "../lib/pro";

// Server-safe subset of apps/www/lib/utils.ts (the DOM/toast/date-fns bits stay
// in the frontend port). Pure string helpers the action layer needs.

export { formatContent, formatUsername } from "../lib/format";

/**
 * Functional Plus perks (polls, group creation): account age OR an active Pro
 * — Pro includes everything in Plus. This is the server-side gate every
 * mutation checks; the client mirror is lib/utils.ts hasPlusFeatures.
 */
export function hasPlusPerks(user: {
  createdAt?: Date | string | null;
  proUntil?: Date | string | null;
}): boolean {
  return hasUmaminPlus(user.createdAt) || hasUmaminPro(user.proUntil);
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
