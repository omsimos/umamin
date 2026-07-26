// group-edit throttle (2 edits/day). The Workers Rate Limiting binding can only
// express a 10s|60s period, so this cap lives outside it.
//
// It runs on the KV binding rather than the Turso edit-window columns the
// migration plan sketched: the state is one tiny per-group value written at most
// ~2×/day, which sits well inside KV's 1-write/sec/key limit and needs no schema
// change. KV's ~60s propagation means a determined owner racing two colos could
// land an extra edit or two — acceptable for a cosmetic cap (the same trade the
// IP denylist already makes), and the `write` limiter still bounds bursts.
//
// FAILS OPEN with no KV binding (local dev) — an unavailable cap must never
// block a legitimate edit.

export const GROUP_EDIT_DAILY_CAP = 2;
const WINDOW_MS = 24 * 60 * 60 * 1000;
// Expire a little past the window so a stale counter can't outlive its window.
const KEY_TTL_SECONDS = Math.ceil((WINDOW_MS * 1.5) / 1000);

export const GROUP_EDIT_RATE_LIMITED_ERROR =
  "You can only edit a group twice a day. Try again later.";

type EditWindow = { count: number; startedAt: number };

function key(groupId: string): string {
  return `group-edit:${groupId}`;
}

function isFreshWindow(window: EditWindow | null, now: number): boolean {
  return (
    !!window &&
    Number.isFinite(window.startedAt) &&
    now - window.startedAt < WINDOW_MS
  );
}

/**
 * Whether this group may be edited right now, CONSUMING one slot of the rolling
 * 24h window when it may. Call it once per accepted edit attempt (a caller that
 * bails after this — e.g. on a validation error — burns a slot; the ownership
 * check runs first, so that only costs the owner).
 */
export async function checkGroupEditWindow(
  kv: KVNamespace | undefined,
  groupId: string,
): Promise<{ allowed: boolean }> {
  if (!kv) return { allowed: true };

  try {
    const now = Date.now();
    const stored = await kv.get<EditWindow>(key(groupId), "json");
    const window = isFreshWindow(stored, now)
      ? (stored as EditWindow)
      : { count: 0, startedAt: now };

    if (window.count >= GROUP_EDIT_DAILY_CAP) {
      return { allowed: false };
    }

    await kv.put(
      key(groupId),
      JSON.stringify({ count: window.count + 1, startedAt: window.startedAt }),
      { expirationTtl: KEY_TTL_SECONDS },
    );
    return { allowed: true };
  } catch {
    // KV outage — never brick a legitimate edit over a cosmetic cap.
    return { allowed: true };
  }
}
