// Public origin used to build an org's shareable submit link. Set
// NEXT_PUBLIC_APP_URL in each environment (prod: https://org.umamin.link).
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const DEFAULT_MESSAGE_CHAR_LIMIT = 1000;
export const MIN_MESSAGE_CHAR_LIMIT = 100;
export const MAX_MESSAGE_CHAR_LIMIT = 5000;

export function resolveMessageCharLimit(
  value: number | null | undefined,
): number {
  return value ?? DEFAULT_MESSAGE_CHAR_LIMIT;
}

export function messageCharLimitError(limit: number): string {
  return `Message cannot exceed ${limit} characters`;
}

export function submitUrl(username: string): string {
  return `${APP_URL}/to/${username}`;
}
