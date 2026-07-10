import type { NextRequest } from "next/server";
import { GROUP_CHAT_ENABLED } from "@/lib/group";
import { publicJson } from "@/lib/public-json";
import { redis } from "@/lib/redis";
import {
  groupChatReactionKey,
  groupChatTailKey,
} from "@/lib/server/group-chat";

// Cheap "anything new?" check the chat poll loop hits each tick: the newest
// message timestamp (`tail`) AND the reaction version (`rxn`), briefly
// CDN-cached so many members' polls collapse to one edge hit and never touch
// Turso. Keyed by the client-supplied group id (?id=) — no tag→id DB lookup.
// Public + unauthenticated by design so the CDN can coalesce; it only exposes
// coarse activity markers, and group metadata is already public. Both null
// without Redis — the client then polls the delta directly and reactions become
// eventual on reload.
// Aligned with the client HEAD_POLL_MS (8s) so many members' polls keep
// collapsing to one CDN hit per window.
const HEAD_CACHE_SECONDS = 8;

export async function GET(req: NextRequest) {
  // Chat is off — keep the response cacheable so stale clients' polls collapse
  // at the CDN and never touch Redis.
  if (!GROUP_CHAT_ENABLED) {
    return publicJson({ tail: null, rxn: null }, HEAD_CACHE_SECONDS);
  }

  const groupId = new URL(req.url).searchParams.get("id");

  if (!redis || !groupId) {
    return publicJson({ tail: null, rxn: null }, HEAD_CACHE_SECONDS);
  }

  const [tail, rxn] = await Promise.all([
    redis.get<number>(groupChatTailKey(groupId)),
    redis.get<number>(groupChatReactionKey(groupId)),
  ]);

  return publicJson(
    { tail: tail ?? null, rxn: rxn ?? null },
    HEAD_CACHE_SECONDS,
  );
}
