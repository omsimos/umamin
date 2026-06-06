import { db } from "@umamin/db";
import { notificationTable } from "@umamin/db/schema/notification";
import { lt } from "drizzle-orm";
import type { NextRequest } from "next/server";

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

// Caps the notification table's size so every per-user badge/list scan stays
// bounded forever — stale aggregates (including ones for retracted likes/
// follows) age out here instead of accumulating.
//
// Triggered by the Vercel Cron in apps/www/vercel.json; Vercel attaches
// `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  // updatedAt is a timestamp-mode column — compare a Date (unlike the session
  // cron's raw-integer expiresAt).
  const result = await db
    .delete(notificationTable)
    .where(
      lt(notificationTable.updatedAt, new Date(Date.now() - RETENTION_MS)),
    );

  return Response.json({ ok: true, deleted: result.rowsAffected ?? 0 });
}
