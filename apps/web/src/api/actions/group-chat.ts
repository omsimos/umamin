import { groupMemberTable, groupTable } from "@umamin/db/schema/group";
import {
  groupMessageReactionTable,
  groupMessageReadTable,
  groupMessageTable,
} from "@umamin/db/schema/group-message";
import { userTable } from "@umamin/db/schema/user";
import { aesEncrypt } from "@umamin/encryption";
import { and, eq, inArray, sql } from "drizzle-orm";
import * as z from "zod";
import { action } from "../../server-lib/action";
import { formatContent } from "../../server-lib/content";
import type { Db } from "../../server-lib/db";
import { UNAUTHORIZED_ERROR } from "../../server-lib/errors";
import {
  GROUP_CHAT_DISABLED_ERROR,
  GROUP_CHAT_ENABLED,
  GROUP_CHAT_REACTION_EMOJIS,
} from "../../server-lib/group";
import { notify } from "../../server-lib/notifications";
import { idSchema } from "../../server-lib/schema";
import { ctxDb, defer } from "./_shared";

// The Redis head keys (tail/rxn) are GONE — the head route reads tail/rxn from
// Turso via withPublicRead now, so the send/react paths no longer write them
// (plan: "group-chat head keys → delete").

const GROUP_MESSAGE_MAX = 1000;
const MAX_MENTIONS = 10;
const MENTION_RE = /@([a-z0-9_-]+)/gi;

function parseMentions(content: string): string[] {
  const found = new Set<string>();
  for (const match of content.matchAll(MENTION_RE)) {
    found.add(match[1].toLowerCase());
    if (found.size >= MAX_MENTIONS) break;
  }
  return Array.from(found);
}

async function isGroupMember(db: Db, groupId: string, userId: string) {
  const [member] = await db
    .select({ id: groupMemberTable.id })
    .from(groupMemberTable)
    .where(
      and(
        eq(groupMemberTable.groupId, groupId),
        eq(groupMemberTable.userId, userId),
      ),
    )
    .limit(1);
  return Boolean(member);
}

export const sendGroupMessageHandler = action(
  {
    schema: z.object({
      groupId: idSchema,
      content: z.string().trim().min(1).max(GROUP_MESSAGE_MAX),
      replyToMessageId: idSchema.optional(),
    }),
    auth: "user",
    rateLimit: {
      name: "group-message",
      key: ({ session }) => `gchat:${session.userId}`,
    },
  },
  async ({ groupId, content, replyToMessageId }, { session, c }) => {
    const db = ctxDb(c);
    if (!GROUP_CHAT_ENABLED) {
      return { error: GROUP_CHAT_DISABLED_ERROR };
    }
    if (!(await isGroupMember(db, groupId, session.userId))) {
      return { error: UNAUTHORIZED_ERROR };
    }

    const formatted = formatContent(content);
    if (!formatted) {
      return { error: "Message cannot be empty" };
    }

    let replyTo: string | null = null;
    if (replyToMessageId) {
      const [parent] = await db
        .select({ id: groupMessageTable.id })
        .from(groupMessageTable)
        .where(
          and(
            eq(groupMessageTable.id, replyToMessageId),
            eq(groupMessageTable.groupId, groupId),
          ),
        )
        .limit(1);
      replyTo = parent?.id ?? null;
    }

    const encrypted = await aesEncrypt(formatted);

    const [row] = await db
      .insert(groupMessageTable)
      .values({
        groupId,
        senderId: session.userId,
        content: encrypted,
        replyToMessageId: replyTo,
      })
      .returning({
        id: groupMessageTable.id,
        createdAt: groupMessageTable.createdAt,
      });

    // Best-effort past the insert — must NOT throw once the row is saved, or a
    // client retry would duplicate it.
    try {
      await db
        .update(groupTable)
        .set({ lastMessageAt: row.createdAt })
        .where(eq(groupTable.id, groupId));

      const mentions = parseMentions(formatted);
      if (mentions.length > 0) {
        const mentioned = await db
          .select({ id: userTable.id })
          .from(userTable)
          .innerJoin(
            groupMemberTable,
            and(
              eq(groupMemberTable.userId, userTable.id),
              eq(groupMemberTable.groupId, groupId),
            ),
          )
          .where(inArray(sql`lower(${userTable.username})`, mentions));

        await Promise.all(
          mentioned.map((m) =>
            notify(
              { db, env: c.env, defer: defer(c) },
              {
                recipientId: m.id,
                type: "group_mention",
                targetId: groupId,
                actorId: session.userId,
              },
            ),
          ),
        );
      }
    } catch (err) {
      console.error("group message side-effects failed", err);
    }

    return { success: true, id: row.id, createdAt: row.createdAt };
  },
);

export const markGroupChatReadHandler = action(
  {
    schema: z.object({
      groupId: idSchema,
      lastReadMessageId: idSchema.optional(),
    }),
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `gchatread:${session.userId}`,
    },
  },
  async ({ groupId, lastReadMessageId }, { session, c }) => {
    const db = ctxDb(c);
    if (!GROUP_CHAT_ENABLED) {
      return { error: GROUP_CHAT_DISABLED_ERROR };
    }
    if (!(await isGroupMember(db, groupId, session.userId))) {
      return { error: UNAUTHORIZED_ERROR };
    }

    const now = new Date();
    await db
      .insert(groupMessageReadTable)
      .values({
        groupId,
        userId: session.userId,
        lastReadMessageId: lastReadMessageId ?? null,
        lastReadAt: now,
      })
      .onConflictDoUpdate({
        target: [groupMessageReadTable.groupId, groupMessageReadTable.userId],
        set: { lastReadMessageId: lastReadMessageId ?? null, lastReadAt: now },
      });

    return { success: true };
  },
);

export const deleteGroupMessageHandler = action(
  {
    schema: z.object({ groupId: idSchema, messageId: idSchema }),
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `gchatdel:${session.userId}`,
    },
  },
  async ({ groupId, messageId }, { session, c }) => {
    const db = ctxDb(c);
    if (!GROUP_CHAT_ENABLED) {
      return { error: GROUP_CHAT_DISABLED_ERROR };
    }
    const [message] = await db
      .select({ senderId: groupMessageTable.senderId })
      .from(groupMessageTable)
      .where(
        and(
          eq(groupMessageTable.id, messageId),
          eq(groupMessageTable.groupId, groupId),
        ),
      )
      .limit(1);

    if (!message) {
      return { success: true };
    }

    if (message.senderId !== session.userId) {
      const [membership] = await db
        .select({ role: groupMemberTable.role })
        .from(groupMemberTable)
        .where(
          and(
            eq(groupMemberTable.groupId, groupId),
            eq(groupMemberTable.userId, session.userId),
          ),
        )
        .limit(1);
      if (membership?.role !== "owner") {
        return { error: UNAUTHORIZED_ERROR };
      }
    }

    await db
      .delete(groupMessageTable)
      .where(
        and(
          eq(groupMessageTable.id, messageId),
          eq(groupMessageTable.groupId, groupId),
        ),
      );

    return { success: true };
  },
);

export const reactToGroupMessageHandler = action(
  {
    schema: z.object({
      groupId: idSchema,
      messageId: idSchema,
      emoji: z.string(),
    }),
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `gchatrxn:${session.userId}`,
    },
  },
  async ({ groupId, messageId, emoji }, { session, c }) => {
    const db = ctxDb(c);
    if (!GROUP_CHAT_ENABLED) {
      return { error: GROUP_CHAT_DISABLED_ERROR };
    }
    if (!(GROUP_CHAT_REACTION_EMOJIS as readonly string[]).includes(emoji)) {
      return { error: "Invalid reaction" };
    }
    if (!(await isGroupMember(db, groupId, session.userId))) {
      return { error: UNAUTHORIZED_ERROR };
    }

    const [message] = await db
      .select({ id: groupMessageTable.id })
      .from(groupMessageTable)
      .where(
        and(
          eq(groupMessageTable.id, messageId),
          eq(groupMessageTable.groupId, groupId),
        ),
      )
      .limit(1);
    if (!message) {
      return { success: true, viewerReaction: null };
    }

    const [existing] = await db
      .select({
        id: groupMessageReactionTable.id,
        emoji: groupMessageReactionTable.emoji,
      })
      .from(groupMessageReactionTable)
      .where(
        and(
          eq(groupMessageReactionTable.messageId, messageId),
          eq(groupMessageReactionTable.userId, session.userId),
        ),
      )
      .limit(1);

    let viewerReaction: string | null = emoji;
    if (existing) {
      if (existing.emoji === emoji) {
        await db
          .delete(groupMessageReactionTable)
          .where(eq(groupMessageReactionTable.id, existing.id));
        viewerReaction = null;
      } else {
        await db
          .update(groupMessageReactionTable)
          .set({ emoji, createdAt: new Date() })
          .where(eq(groupMessageReactionTable.id, existing.id));
      }
    } else {
      await db
        .insert(groupMessageReactionTable)
        .values({ messageId, userId: session.userId, emoji });
    }

    return { success: true, viewerReaction };
  },
);
