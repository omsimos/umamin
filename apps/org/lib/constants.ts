// Public origin used to build an org's shareable submit link. Set
// NEXT_PUBLIC_APP_URL in each environment (prod: https://org.umamin.link).
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const MAX_MESSAGE_LENGTH = 1000;

export function submitUrl(username: string): string {
  return `${APP_URL}/to/${username}`;
}
