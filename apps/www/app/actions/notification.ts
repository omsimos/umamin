"use server";

import { db } from "@umamin/db";
import { userTable } from "@umamin/db/schema/user";
import { eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { getSession } from "@/lib/auth";
import { checkRateLimit, RATE_LIMIT_ERROR } from "@/lib/ratelimit";

/**
 * Marks every notification as seen by advancing the per-user watermark —
 * one row written, regardless of how many notifications were unread.
 */
export async function markNotificationsSeenAction() {
  try {
    const { session } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

    if (!(await checkRateLimit("write", `notifseen:${session.userId}`))) {
      return { error: RATE_LIMIT_ERROR };
    }

    await db
      .update(userTable)
      .set({ lastSeenNotificationsAt: new Date() })
      .where(eq(userTable.id, session.userId));

    updateTag(`notifications:${session.userId}`);

    return { success: true };
  } catch (err) {
    console.log(err);
    return { error: "An error occurred" };
  }
}
