"use server";

import { db } from "@umamin/db";
import { messageTable } from "@umamin/db/schema/message";
import { userBlockTable, userTable } from "@umamin/db/schema/user";
import { aesEncrypt } from "@umamin/encryption";
import { and, eq, isNull, or } from "drizzle-orm";
import { updateTag } from "next/cache";
import * as z from "zod";
import { matchesBlockedWords } from "@/lib/blocked-words";
import { getClientIp } from "@/lib/ratelimit";
import { idSchema } from "@/lib/schema";
import { ACCESS_BLOCKED_ERROR } from "@/lib/server/errors";
import { isIpDenied } from "@/lib/server/ip-denylist";
import { notify } from "@/lib/server/notifications";
import { withAction } from "@/lib/server/with-action";
import { formatContent } from "@/lib/utils";

export const deleteMessageAction = withAction(
  {
    schema: idSchema,
    rateLimit: {
      name: "write",
      key: ({ session }) => `delmsg:${session.userId}`,
    },
  },
  async (id, { session }) => {
    await db
      .delete(messageTable)
      .where(
        and(
          eq(messageTable.id, id),
          eq(messageTable.receiverId, session.userId),
        ),
      );

    updateTag(`messages:received:${session.userId}`);

    return { success: true };
  },
);

export const openMessageAction = withAction(
  {
    schema: z.object({ messageId: idSchema }),
    rateLimit: {
      name: "write",
      key: ({ session }) => `openmsg:${session.userId}`,
    },
  },
  async ({ messageId }, { session }) => {
    // Idempotent + IDOR-scoped: only flips a still-sealed row owned by the
    // viewer — a re-open is a 0-row no-op so the timestamp is never rewritten.
    const updated = await db
      .update(messageTable)
      .set({ openedAt: new Date() })
      .where(
        and(
          eq(messageTable.id, messageId),
          eq(messageTable.receiverId, session.userId),
          isNull(messageTable.openedAt),
        ),
      )
      .returning({ id: messageTable.id });

    // A no-op (already opened, wrong owner, missing id) still returns success:
    // the client revealed optimistically, and an unknown id must not leak
    // whether a message exists.
    if (updated.length > 0) {
      updateTag(`messages:received:${session.userId}`);
    }

    return { success: true, opened: updated.length > 0 };
  },
);

export const createReplyAction = withAction(
  {
    schema: z.object({
      messageId: z.string().min(1),
      content: z
        .string()
        .trim()
        .min(1, { error: "Content cannot be empty" })
        .max(500, { error: "Content cannot exceed 500 characters" }),
    }),
    rateLimit: {
      name: "message",
      key: ({ session }) => `reply:${session.userId}`,
    },
  },
  async ({ messageId, content }, { session }) => {
    const encryptedReply = await aesEncrypt(content);

    // Scope to the viewer's own messages (prevents IDOR) AND confirm a row was
    // actually updated — otherwise a missing/non-owned messageId would return
    // success and the optimistic UI would show a reply that was never saved.
    const updated = await db
      .update(messageTable)
      .set({
        reply: encryptedReply,
      })
      .where(
        and(
          eq(messageTable.id, messageId),
          eq(messageTable.receiverId, session.userId),
        ),
      )
      .returning({ id: messageTable.id, senderId: messageTable.senderId });

    if (updated.length === 0) {
      return { error: "Message not found" };
    }

    updateTag(`messages:received:${session.userId}`);

    // Only a logged-in sender can be notified; the replier's identity isn't a
    // leak — the sender chose this recipient. No preview: replies are encrypted.
    if (updated[0].senderId) {
      await notify({
        recipientId: updated[0].senderId,
        type: "reply",
        targetId: messageId,
        actorId: session.userId,
      });
    }

    return { success: true, reply: content, updatedAt: new Date() };
  },
);

const sendMessageSchema = z.object({
  question: z.string().trim().min(1).max(500),
  content: z.string().trim().min(1).max(500),
  receiverId: z.string().min(1),
});

export const sendMessageAction = withAction(
  {
    schema: sendMessageSchema,
    auth: "none",
    // Throttle anonymous/unauthenticated spam before any DB work or AES.
    // No-ops until Redis is configured (e.g. local dev). The wrapper runs an
    // IP-keyed limiter for auth "none" before the session lookup.
    rateLimit: {
      name: "message",
      key: async () => `msg:${await getClientIp()}`,
    },
  },
  async ({ question, content, receiverId }, { session }) => {
    // Block the main anonymous spam vector from denylisted IPs (the rate-limit
    // key above already resolved the IP). No-ops without Redis.
    if (await isIpDenied(await getClientIp())) {
      return { error: ACCESS_BLOCKED_ERROR };
    }

    const senderId = session?.userId ?? null;

    if (receiverId === senderId) {
      return { error: "You can't send a message to yourself" };
    }

    // Two independent reads — run them together (async-parallel). The block
    // lookup only applies to a logged-in sender; quiet mode always applies.
    const [blocked, receiver] = await Promise.all([
      senderId
        ? db.query.userBlockTable.findFirst({
            columns: { id: true },
            where: or(
              and(
                eq(userBlockTable.blockerId, receiverId),
                eq(userBlockTable.blockedId, senderId),
              ),
              and(
                eq(userBlockTable.blockerId, senderId),
                eq(userBlockTable.blockedId, receiverId),
              ),
            ),
          })
        : Promise.resolve(undefined),
      db.query.userTable.findFirst({
        columns: { quietMode: true, blockedWords: true },
        where: eq(userTable.id, receiverId),
      }),
    ]);

    // Both gates fail silently (don't reveal block/quiet state, and cover a
    // non-existent receiverId) — the client can't distinguish a dropped send
    // from a delivered one. Quiet mode is enforced server-side because the
    // client toggle is a UI hint, not a security boundary.
    if (blocked || !receiver || receiver.quietMode) {
      return { success: true };
    }

    // Same silent drop as block/quiet — a sender must not be able to probe the
    // receiver's blocked words. Checked against the formatted plaintext (what
    // would be stored), before any crypto work.
    const formattedContent = formatContent(content);
    if (matchesBlockedWords(formattedContent, receiver.blockedWords)) {
      return { success: true };
    }

    // Encrypt only after the above checks so a dropped send does no crypto work.
    const encryptedContent = await aesEncrypt(formattedContent);

    await db.insert(messageTable).values({
      senderId,
      receiverId,
      question,
      content: encryptedContent,
    });

    if (senderId) {
      updateTag(`messages:sent:${senderId}`);
    }
    updateTag(`messages:received:${receiverId}`);

    // actorId stays null even for a logged-in sender — messages are anonymous.
    // No preview: content is encrypted at rest.
    await notify({ recipientId: receiverId, type: "message" });

    return { success: true };
  },
);
