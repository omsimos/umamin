import { publicJson } from "@/lib/public-json";
import { redis } from "@/lib/redis";

// Newest feed-edge timestamp, used by the client to show a "new posts" pill
// without polling Turso. Briefly CDN-cached so many clients' polls collapse to
// one edge hit. Returns { latest: null } when Redis isn't configured (the pill
// feature is then simply inactive — no error).
const HEAD_CACHE_SECONDS = 30;

export async function GET() {
  if (!redis) {
    return publicJson({ latest: null }, HEAD_CACHE_SECONDS);
  }

  const latest = await redis.get<number>("feed:latest");
  return publicJson({ latest: latest ?? null }, HEAD_CACHE_SECONDS);
}
