"use server";

import { db } from "@umamin/db";
import { userTable } from "@umamin/db/schema/user";
import { eq, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import * as z from "zod";
import { getSession } from "@/lib/auth";
import { checkRateLimit, RATE_LIMIT_ERROR } from "@/lib/ratelimit";

const markSeenSchema = z.object({
  // Epoch ms of the newest notification the client actually rendered.
  seenThrough: z.coerce.date(),
});

/**
 * Marks notifications as seen by advancing the per-user watermark — one row
 * written, regardless of how many notifications were unread.
 *
 * The watermark advances only through what the client rendered (not "now"), so
 * a notification arriving between render and this call stays unseen. Clamped
 * to the server clock, and max()'d so a stale tab can't regress it and
 * re-light already-seen notifications.
 */
export async function markNotificationsSeenAction(values: {
  seenThrough: number;
}) {
  try {
    const params = markSeenSchema.safeParse(values);

    if (!params.success) {
      return { error: "Invalid input" };
    }

    const { session } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

    if (!(await checkRateLimit("write", `notifseen:${session.userId}`))) {
      return { error: RATE_LIMIT_ERROR };
    }

    // The column stores epoch seconds ({ mode: "timestamp" }).
    const seenThroughSeconds = Math.min(
      Math.floor(params.data.seenThrough.getTime() / 1000),
      Math.floor(Date.now() / 1000),
    );

    await db
      .update(userTable)
      .set({
        lastSeenNotificationsAt: sql`max(coalesce(${userTable.lastSeenNotificationsAt}, 0), ${seenThroughSeconds})`,
      })
      .where(eq(userTable.id, session.userId));

    // Badge tag only — seen-state isn't rendered in the list, so the list
    // cache the page just populated stays warm.
    updateTag(`notifications-badge:${session.userId}`);

    return { success: true };
  } catch (err) {
    console.log(err);
    return { error: "An error occurred" };
  }
}
