import { messageTable } from "@umamin/db/schema/message";
import { userBlockTable, userTable } from "@umamin/db/schema/user";
import { aesEncrypt } from "@umamin/encryption";
import { and, eq, isNull, or } from "drizzle-orm";
import * as z from "zod";
import { action } from "../../server-lib/action";
import { matchesBlockedWords } from "../../server-lib/blocked-words";
import { formatContent } from "../../server-lib/content";
import { ACCESS_BLOCKED_ERROR } from "../../server-lib/errors";
import { extractClientIp } from "../../server-lib/ip";
import { isIpDenied } from "../../server-lib/ip-denylist";
import { notify } from "../../server-lib/notifications";
import { idSchema } from "../../server-lib/schema";
import { ctxDb, defer } from "./_shared";

export const deleteMessageHandler = action(
  {
    schema: idSchema,
    rateLimit: {
      name: "write",
      key: ({ session }) => `delmsg:${session.userId}`,
    },
  },
  async (id, { session, c }) => {
    await ctxDb(c)
      .delete(messageTable)
      .where(
        and(
          eq(messageTable.id, id),
          eq(messageTable.receiverId, session.userId),
        ),
      );
    return { success: true };
  },
);

export const openMessageHandler = action(
  {
    schema: z.object({ messageId: idSchema }),
    rateLimit: {
      name: "write",
      key: ({ session }) => `openmsg:${session.userId}`,
    },
  },
  async ({ messageId }, { session, c }) => {
    const updated = await ctxDb(c)
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

    return { success: true, opened: updated.length > 0 };
  },
);

export const createReplyHandler = action(
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
  async ({ messageId, content }, { session, c }) => {
    const db = ctxDb(c);
    const encryptedReply = await aesEncrypt(content);

    const updated = await db
      .update(messageTable)
      .set({ reply: encryptedReply })
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

    if (updated[0].senderId) {
      await notify(
        { db, env: c.env, defer: defer(c) },
        {
          recipientId: updated[0].senderId,
          type: "reply",
          targetId: messageId,
          actorId: session.userId,
        },
      );
    }

    return { success: true, reply: content, updatedAt: new Date() };
  },
);

const sendMessageSchema = z.object({
  question: z.string().trim().min(1).max(500),
  content: z.string().trim().min(1).max(500),
  receiverId: z.string().min(1),
});

export const sendMessageHandler = action(
  {
    schema: sendMessageSchema,
    auth: "none",
    // Anonymous vector: IP-keyed limiter runs BEFORE the session lookup.
    rateLimit: {
      name: "message",
      key: ({ c }) => `msg:${extractClientIp((n) => c.req.header(n))}`,
    },
  },
  async ({ question, content, receiverId }, { session, c }) => {
    const db = ctxDb(c);
    const ip = extractClientIp((n) => c.req.header(n));

    if (await isIpDenied(c.env.KV, ip)) {
      return { error: ACCESS_BLOCKED_ERROR };
    }

    const senderId = session?.userId ?? null;

    if (receiverId === senderId) {
      return { error: "You can't send a message to yourself" };
    }

    const [blockedRows, receiverRows] = await Promise.all([
      senderId
        ? db
            .select({ id: userBlockTable.id })
            .from(userBlockTable)
            .where(
              or(
                and(
                  eq(userBlockTable.blockerId, receiverId),
                  eq(userBlockTable.blockedId, senderId),
                ),
                and(
                  eq(userBlockTable.blockerId, senderId),
                  eq(userBlockTable.blockedId, receiverId),
                ),
              ),
            )
            .limit(1)
        : Promise.resolve([]),
      db
        .select({
          quietMode: userTable.quietMode,
          blockedWords: userTable.blockedWords,
        })
        .from(userTable)
        .where(eq(userTable.id, receiverId))
        .limit(1),
    ]);

    const blocked = blockedRows[0];
    const receiver = receiverRows[0];

    if (blocked || !receiver || receiver.quietMode) {
      return { success: true };
    }

    const formattedContent = formatContent(content);
    if (matchesBlockedWords(formattedContent, receiver.blockedWords)) {
      return { success: true };
    }

    const encryptedContent = await aesEncrypt(formattedContent);

    await db.insert(messageTable).values({
      senderId,
      receiverId,
      question,
      content: encryptedContent,
    });

    await notify(
      { db, env: c.env, defer: defer(c) },
      { recipientId: receiverId, type: "message" },
    );

    return { success: true };
  },
);
