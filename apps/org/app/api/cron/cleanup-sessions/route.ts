import { db } from "@umamin/org-db";
import { orgSessionTable } from "@umamin/org-db/schema/session";
import { lt } from "drizzle-orm";

// Vercel cron (see vercel.json). Deletes sessions past their expiry so the
// table doesn't accumulate forever. Fails CLOSED: a missing CRON_SECRET denies
// (Vercel auto-injects the Authorization header for scheduled invocations).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  await db
    .delete(orgSessionTable)
    .where(lt(orgSessionTable.expiresAt, Date.now()));

  return Response.json({ ok: true });
}
