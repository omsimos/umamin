import type { NextRequest } from "next/server";
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
const HEAD_CACHE_SECONDS = 5;

export async function GET(req: NextRequest) {
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
