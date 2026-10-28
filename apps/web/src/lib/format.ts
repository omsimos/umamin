// Pure string helpers shared by the client, the action layer and the Hono
// routes. Keep this file import-free so server code can use it.

// The profile routes accept a `@`-prefixed username segment. apps/www only had
// to strip the literal `%40` because Next hands route params RAW; Hono's
// `c.req.param()` percent-DECODES, so `/user/%40josh` arrives here as `@josh`.
// Both forms are stripped — a `@`-style shared or bookmarked profile URL would
// otherwise miss the lookup and 404.
export function formatUsername(username: string): string {
  if (username.startsWith("%40")) return username.slice(3);
  if (username.startsWith("@")) return username.slice(1);
  return username;
}

export function formatContent(content: string) {
  return content.replace(/(\r\n|\n|\r){2,}/g, "\n\n").trim();
}
