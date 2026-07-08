import { randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";

// Identical parameters everywhere a password is hashed or verified (CLI + app
// login + password change) so failed logins can't be timed against successes.
export const ARGON2_OPTS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTS);
}

export function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  return verify(passwordHash, password, ARGON2_OPTS);
}

// Default password minted by the provisioning CLIs (create-org/reset-password).
// 12 bytes -> 16 url-safe chars; strong and copy-pasteable.
export function generateDefaultPassword(): string {
  return randomBytes(12).toString("base64url");
}

// Shared username rule (lowercase a-z0-9 + underscore, 3-20 chars).
export const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}
