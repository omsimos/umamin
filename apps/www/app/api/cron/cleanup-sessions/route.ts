import { db } from "@umamin/db";
import { sessionTable } from "@umamin/db/schema/user";
import { lt } from "drizzle-orm";
import type { NextRequest } from "next/server";

// Expired sessions are otherwise pruned only lazily when their owner next makes
// a request, so abandoned sessions accumulate forever. This cron sweeps them so
// the session table (and the rows scanned on every auth check) stays small.
//
// Triggered by the Vercel Cron defined in apps/www/vercel.json. Vercel attaches
// `Authorization: Bearer <CRON_SECRET>` to cron invocations when CRON_SECRET is
// set, which is what we verify below. Set CRON_SECRET in the project env.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await db
    .delete(sessionTable)
    .where(lt(sessionTable.expiresAt, Date.now()));

  return Response.json({ ok: true, deleted: result.rowsAffected ?? 0 });
}
