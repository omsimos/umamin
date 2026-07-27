export const MAX_BLOCKED_WORDS = 50;
export const MAX_BLOCKED_WORD_LENGTH = 100;

/**
 * Case-insensitive substring match; multi-word phrases match contiguously.
 * Entries are re-trimmed here so a stale/hand-written row can't break matching.
 */
export function matchesBlockedWords(
  content: string,
  blockedWords: readonly string[] | null | undefined,
): boolean {
  if (!blockedWords?.length) return false;

  const haystack = content.toLowerCase();
  return blockedWords.some((word) => {
    const needle = word.trim().toLowerCase();
    return needle.length > 0 && haystack.includes(needle);
  });
}

/**
 * Server-side bounding for the client-supplied list: strings only, trimmed,
 * length-capped, case-insensitively deduped, list capped. Original casing of
 * the first occurrence is kept for display.
 */
export function sanitizeBlockedWords(input: unknown): string[] {
  if (!Array.isArray(input)) return [];

  const seen = new Set<string>();
  const words: string[] = [];

  for (const raw of input) {
    if (typeof raw !== "string") continue;

    const trimmed = raw.trim().slice(0, MAX_BLOCKED_WORD_LENGTH).trim();
    if (!trimmed) continue;

    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    words.push(trimmed);
    if (words.length >= MAX_BLOCKED_WORDS) break;
  }

  return words;
}
