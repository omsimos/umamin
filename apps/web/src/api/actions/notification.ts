import { userTable } from "@umamin/db/schema/user";
import { eq, sql } from "drizzle-orm";
import * as z from "zod";
import { action } from "../../server-lib/action";
import { ctxDb } from "./_shared";

const markSeenSchema = z.object({
  // Epoch ms of the newest notification the client actually rendered.
  seenThrough: z.number(),
});

/**
 * Advances the per-user seen watermark — one row written regardless of unread
 * count. Clamped to the server clock and max()'d so a stale tab can't regress it.
 */
export const markNotificationsSeenHandler = action(
  {
    schema: markSeenSchema,
    rateLimit: {
      name: "write",
      key: ({ session }) => `notifseen:${session.userId}`,
    },
  },
  async ({ seenThrough }, { session, c }) => {
    const seenThroughSeconds = Math.min(
      Math.floor(seenThrough / 1000),
      Math.floor(Date.now() / 1000),
    );

    await ctxDb(c)
      .update(userTable)
      .set({
        lastSeenNotificationsAt: sql`max(coalesce(${userTable.lastSeenNotificationsAt}, 0), ${seenThroughSeconds})`,
      })
      .where(eq(userTable.id, session.userId));

    return { success: true };
  },
);
