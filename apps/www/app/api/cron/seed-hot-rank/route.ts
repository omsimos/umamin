import type { NextRequest } from "next/server";
import { seedHotPostRanks } from "@/lib/server/feed-rank";

// One-off backfill for the v2 hot-rank zset — deliberately NOT scheduled in
// vercel.json (incremental refreshes maintain the set forever after). Curl it
// once after the release that bumps the key:
//   curl -H "Authorization: Bearer $CRON_SECRET" .../api/cron/seed-hot-rank
// Reuses the cron auth convention so the secret already exists in the env.
// `seeded: null` means the Redis binding is unset.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const seeded = await seedHotPostRanks();

  return Response.json({ ok: true, seeded });
}
