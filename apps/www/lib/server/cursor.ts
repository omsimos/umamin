import "server-only";

/**
 * Parses a `<epochMs>.<id>` pagination cursor. Malformed input (including a
 * non-numeric timestamp, which would otherwise become an Invalid Date and leak
 * NaN into the SQL driver) degrades to null — i.e. the first page — instead of
 * a 500.
 */
export function parseCursor(cursor: string | null) {
  if (!cursor) return null;

  const sep = cursor.indexOf(".");
  if (sep <= 0) return null;

  const ms = Number(cursor.slice(0, sep));
  if (!Number.isFinite(ms)) return null;

  const cursorId = cursor.slice(sep + 1);
  const cursorDate = new Date(ms);

  return {
    cursorId,
    cursorDate,
  };
}
