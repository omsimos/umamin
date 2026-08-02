import { messageReplyTable, messageTable } from "@umamin/db/schema/message";
import { userBlockTable, userTable } from "@umamin/db/schema/user";
import { aesEncrypt } from "@umamin/encryption";
import { and, eq, isNull, or, sql } from "drizzle-orm";
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

// Both sides of a thread post here; the role is derived server-side from the
// message row, never from the client. The receiver's FIRST reply still lands
// on the legacy message.reply column (keeps the www rollback rendering and the
// list preview); every later entry — either side — is a message_reply row. The
// sender may only continue once the receiver has replied, i.e. reply is set.
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

    const [msg] = await db
      .select({
        id: messageTable.id,
        receiverId: messageTable.receiverId,
        senderId: messageTable.senderId,
        reply: messageTable.reply,
      })
      .from(messageTable)
      .where(eq(messageTable.id, messageId))
      .limit(1);

    const isReceiver = msg?.receiverId === session.userId;
    const isSender = msg != null && msg.senderId === session.userId;

    if (!msg || (!isReceiver && !isSender)) {
      return { error: "Message not found" };
    }

    if (isSender && !msg.reply) {
      return { error: "You can reply once they respond" };
    }

    const formatted = formatContent(content);
    if (!formatted) {
      return { error: "Content cannot be empty" };
    }

    // Independent guards share one round trip (Tokyo RTs dominate latency).
    const [blockedRows, receiverRows] = await Promise.all([
      msg.senderId
        ? db
            .select({ id: userBlockTable.id })
            .from(userBlockTable)
            .where(
              or(
                and(
                  eq(userBlockTable.blockerId, msg.receiverId),
                  eq(userBlockTable.blockedId, msg.senderId),
                ),
                and(
                  eq(userBlockTable.blockerId, msg.senderId),
                  eq(userBlockTable.blockedId, msg.receiverId),
                ),
              ),
            )
            .limit(1)
        : Promise.resolve([]),
      isSender
        ? db
            .select({ blockedWords: userTable.blockedWords })
            .from(userTable)
            .where(eq(userTable.id, msg.receiverId))
            .limit(1)
        : Promise.resolve([]),
    ]);

    // Blocks hide the message from both lists, so a blocked thread reads as
    // gone here too — same signal, no new block-detection surface.
    if (blockedRows.length > 0) {
      return { error: "Message not found" };
    }

    if (isSender) {
      // Same silent drop as sendMessage: the receiver's filters must not be
      // probeable through the thread.
      const receiver = receiverRows[0];
      if (!receiver || matchesBlockedWords(formatted, receiver.blockedWords)) {
        return { success: true };
      }
    }

    const encrypted = await aesEncrypt(formatted);
    const now = new Date();

    if (isReceiver && !msg.reply) {
      const updated = await db
        .update(messageTable)
        .set({
          reply: encrypted,
          lastReplyAt: now,
          receiverReadAt: now,
        })
        .where(and(eq(messageTable.id, messageId), isNull(messageTable.reply)))
        .returning({ id: messageTable.id });

      if (updated.length === 0) {
        return { error: "Message not found" };
      }

      if (msg.senderId) {
        await notify(
          { db, env: c.env, defer: defer(c) },
          {
            recipientId: msg.senderId,
            type: "reply",
            targetId: messageId,
            actorId: session.userId,
          },
        );
      }

      return { success: true, reply: formatted, updatedAt: now };
    }

    // One atomic round trip: the reply row plus the parent bump land together
    // (no window where the row exists but lastReplyAt lags). Writing the
    // author's own watermark keeps their reply from reading as unread to
    // themselves; updatedAt is pinned because $onUpdate would otherwise stamp
    // this metadata write as if the legacy reply content changed.
    const [inserted] = await db.batch([
      db
        .insert(messageReplyTable)
        .values({
          messageId,
          fromSender: isSender,
          content: encrypted,
        })
        .returning({
          id: messageReplyTable.id,
          createdAt: messageReplyTable.createdAt,
        }),
      db
        .update(messageTable)
        .set({
          lastReplyAt: now,
          ...(isSender ? { senderReadAt: now } : { receiverReadAt: now }),
          updatedAt: sql`${messageTable.updatedAt}`,
        })
        .where(eq(messageTable.id, messageId)),
    ]);
    const row = inserted[0];

    // Best-effort past the write — a notification must never fail the send.
    try {
      if (isSender) {
        await notify(
          { db, env: c.env, defer: defer(c) },
          // Actor stays null — a thread notification must never name the
          // anonymous sender.
          { recipientId: msg.receiverId, type: "thread", targetId: messageId },
        );
      } else if (msg.senderId) {
        await notify(
          { db, env: c.env, defer: defer(c) },
          {
            recipientId: msg.senderId,
            type: "reply",
            targetId: messageId,
            actorId: session.userId,
          },
        );
      }
    } catch (err) {
      console.error("thread reply post-insert failed", err);
    }

    return {
      success: true,
      entry: {
        id: row.id,
        content: formatted,
        fromSender: isSender,
        createdAt: row.createdAt,
      },
    };
  },
);

// Watermark write on thread open (group_message_read pattern) — called once
// when the thread page mounts, never per fetch, and skipped client-side when
// there is nothing unread. One statement: each side's CASE moves only its own
// watermark (a non-participant matches neither), the receiver's first open
// also unseals (openedAt, replacing a second openMessage call), and updatedAt
// is pinned so a read never restamps the legacy reply's displayed time.
export const markThreadReadHandler = action(
  {
    schema: z.object({ messageId: idSchema }),
    rateLimit: {
      name: "write",
      key: ({ session }) => `threadread:${session.userId}`,
    },
  },
  async ({ messageId }, { session, c }) => {
    const db = ctxDb(c);

    await db
      .update(messageTable)
      .set({
        receiverReadAt: sql`CASE WHEN ${messageTable.receiverId} = ${session.userId} THEN unixepoch() ELSE ${messageTable.receiverReadAt} END`,
        senderReadAt: sql`CASE WHEN ${messageTable.senderId} = ${session.userId} THEN unixepoch() ELSE ${messageTable.senderReadAt} END`,
        openedAt: sql`CASE WHEN ${messageTable.receiverId} = ${session.userId} THEN COALESCE(${messageTable.openedAt}, unixepoch()) ELSE ${messageTable.openedAt} END`,
        updatedAt: sql`${messageTable.updatedAt}`,
      })
      .where(
        and(
          eq(messageTable.id, messageId),
          or(
            eq(messageTable.receiverId, session.userId),
            eq(messageTable.senderId, session.userId),
          ),
        ),
      );

    return { success: true };
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
