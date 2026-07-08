// Public origin used to build submit links and the ShareCard footer. Set
// NEXT_PUBLIC_APP_URL in each environment (prod: https://org.umamin.link).
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Bare host (no protocol) for the ShareCard footer.
export const APP_HOST = APP_URL.replace(/^https?:\/\//, "");

export const MAX_MESSAGE_LENGTH = 1000;

export function submitUrl(username: string): string {
  return `${APP_URL}/to/${username}`;
}
