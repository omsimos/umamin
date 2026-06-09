"use server";

import { db } from "@umamin/db";
import { groupMemberTable, groupTable } from "@umamin/db/schema/group";
import {
  groupMessageReactionTable,
  groupMessageReadTable,
  groupMessageTable,
} from "@umamin/db/schema/group-message";
import { userTable } from "@umamin/db/schema/user";
import { aesEncrypt } from "@umamin/encryption";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import * as z from "zod";
import { GROUP_CHAT_REACTION_EMOJIS } from "@/lib/group";
import { redis } from "@/lib/redis";
import { idSchema } from "@/lib/schema";
import { UNAUTHORIZED_ERROR } from "@/lib/server/errors";
import {
  groupChatReactionKey,
  groupChatTailKey,
} from "@/lib/server/group-chat";
import { notify } from "@/lib/server/notifications";
import { withAction } from "@/lib/server/with-action";
import { formatContent } from "@/lib/utils";

const GROUP_MESSAGE_MAX = 1000;
// Distinct @mentions that actually notify, per message. Real chat rarely tags
// more than a handful; the low cap bounds the notification-upsert fan-out (one
// write per distinct mentioned member) on the tighter Turso write axis.
const MAX_MENTIONS = 10;
const MENTION_RE = /@([a-z0-9_-]+)/gi;

// Distinct, lowercased @handles in a message, bounded so mention spam can't
// unbound the resolve/notify fan-out.
function parseMentions(content: string): string[] {
  const found = new Set<string>();
  for (const match of content.matchAll(MENTION_RE)) {
    found.add(match[1].toLowerCase());
    if (found.size >= MAX_MENTIONS) break;
  }
  return Array.from(found);
}

// One bounded read on group_member_group_user_uidx — re-checked on every send
// (and read-state write) so a kicked/left member is cut off on their very next
// request, no token-staleness window.
async function isGroupMember(groupId: string, userId: string) {
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

export const sendGroupMessageAction = withAction(
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
  async ({ groupId, content, replyToMessageId }, { session }) => {
    if (!(await isGroupMember(groupId, session.userId))) {
      return { error: UNAUTHORIZED_ERROR };
    }

    const formatted = formatContent(content);
    if (!formatted) {
      return { error: "Message cannot be empty" };
    }

    // Only accept a reply target that's a real message in THIS group;
    // anything else degrades to a plain message rather than erroring.
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

    // Everything past the insert is best-effort: it must NOT throw the action
    // once the row is saved, or the client would mark the message "failed" and
    // a retry would duplicate it.
    try {
      // Denormalized newest-message marker for the hub unread dot — one bounded
      // PK write per send (members derive unread from this vs their watermark).
      await db
        .update(groupTable)
        .set({ lastMessageAt: row.createdAt })
        .where(eq(groupTable.id, groupId));

      // Advance the CDN-cached tail so other members' head-checks see the
      // change without touching Turso. No-ops without Redis.
      if (redis) {
        await redis.set(groupChatTailKey(groupId), row.createdAt.getTime());
      }

      // Notify @mentioned MEMBERS only (one bounded resolve when @s are
      // present; notify() aggregates per (recipient, group) and skips self).
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
            notify({
              recipientId: m.id,
              type: "group_mention",
              targetId: groupId,
              actorId: session.userId,
            }),
          ),
        );
      }
    } catch (err) {
      console.error("group message side-effects failed", err);
    }

    // Read-your-writes for the sender's own cached history page.
    updateTag(`group-messages:${groupId}`);

    return { success: true, id: row.id, createdAt: row.createdAt };
  },
);

// Read watermark for future unread badges. Written sparingly (room open / leave),
// NEVER per poll — a per-tick write would dominate Turso writes for nothing.
export const markGroupChatReadAction = withAction(
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
  async ({ groupId, lastReadMessageId }, { session }) => {
    if (!(await isGroupMember(groupId, session.userId))) {
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

    // Clear the hub unread dot read-your-writes for this viewer.
    updateTag(`unread-groups:${session.userId}`);

    return { success: true };
  },
);

export const deleteGroupMessageAction = withAction(
  {
    schema: z.object({ groupId: idSchema, messageId: idSchema }),
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `gchatdel:${session.userId}`,
    },
  },
  async ({ groupId, messageId }, { session }) => {
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

    // Idempotent + non-leaking: a missing/foreign message is a silent no-op.
    if (!message) {
      return { success: true };
    }

    // Author may delete their own; otherwise only the group owner.
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

    updateTag(`group-messages:${groupId}`);

    // Recompute the tail so the poll loop doesn't chase a deleted newest
    // message every tick (one bounded read; deletes are rare).
    if (redis) {
      const [newest] = await db
        .select({ createdAt: groupMessageTable.createdAt })
        .from(groupMessageTable)
        .where(eq(groupMessageTable.groupId, groupId))
        .orderBy(desc(groupMessageTable.createdAt), desc(groupMessageTable.id))
        .limit(1);
      if (newest) {
        await redis.set(groupChatTailKey(groupId), newest.createdAt.getTime());
      } else {
        await redis.del(groupChatTailKey(groupId));
      }
    }

    return { success: true };
  },
);

export const reactToGroupMessageAction = withAction(
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
  async ({ groupId, messageId, emoji }, { session }) => {
    if (!(GROUP_CHAT_REACTION_EMOJIS as readonly string[]).includes(emoji)) {
      return { error: "Invalid reaction" };
    }
    if (!(await isGroupMember(groupId, session.userId))) {
      return { error: UNAUTHORIZED_ERROR };
    }

    // Confirm the target is a real message in this group (non-leaking no-op).
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

    // One reaction per (message, user): same emoji toggles off, a different
    // emoji replaces, none inserts.
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

    // Bump the reaction version so other members' poll loops refetch reaction
    // state for their loaded messages (a reaction doesn't move the tail).
    if (redis) {
      await redis.set(groupChatReactionKey(groupId), Date.now());
    }

    return { success: true, viewerReaction };
  },
);
