"use server";

import { db } from "@umamin/db";
import { messageTable } from "@umamin/db/schema/message";
import { userBlockTable, userTable } from "@umamin/db/schema/user";
import { aesEncrypt } from "@umamin/encryption";
import { and, eq, or } from "drizzle-orm";
import { updateTag } from "next/cache";
import * as z from "zod";
import { getSession } from "@/lib/auth";
import { checkRateLimit, getClientIp, RATE_LIMIT_ERROR } from "@/lib/ratelimit";
import { formatContent } from "@/lib/utils";

export async function deleteMessageAction(id: string) {
  try {
    const parsed = z.string().min(1).safeParse(id);
    if (!parsed.success) {
      return { error: "Invalid input" };
    }
    const { session } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

    if (!(await checkRateLimit("write", `delmsg:${session.userId}`))) {
      return { error: RATE_LIMIT_ERROR };
    }

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
  } catch (err) {
    console.log(err);
    return { error: "An error occurred" };
  }
}

type CreateReplyParams = {
  messageId: string;
  content: string;
};

export async function createReplyAction({
  messageId,
  content,
}: CreateReplyParams) {
  try {
    const params = z
      .object({
        messageId: z.string().min(1),
        content: z
          .string()
          .trim()
          .min(1, { error: "Content cannot be empty" })
          .max(500, { error: "Content cannot exceed 500 characters" }),
      })
      .safeParse({ messageId, content });

    if (!params.success) {
      return { error: "Invalid input" };
    }

    const { session } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

    if (!(await checkRateLimit("message", `reply:${session.userId}`))) {
      return { error: RATE_LIMIT_ERROR };
    }

    const encryptedReply = await aesEncrypt(params.data.content);

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
      .returning({ id: messageTable.id });

    if (updated.length === 0) {
      return { error: "Message not found" };
    }

    updateTag(`messages:received:${session.userId}`);

    return { success: true, reply: params.data.content, updatedAt: new Date() };
  } catch (err) {
    console.log(err);
    return { error: "An error occurred" };
  }
}

const sendMessageSchema = z.object({
  question: z.string().trim().min(1).max(500),
  content: z.string().trim().min(1).max(500),
  receiverId: z.string().min(1),
});

export async function sendMessageAction(
  values: z.infer<typeof sendMessageSchema>,
) {
  try {
    const params = sendMessageSchema.safeParse(values);

    if (!params.success) {
      return { error: "Invalid input" };
    }

    const { question, content, receiverId } = params.data;

    // Throttle anonymous/unauthenticated spam before any DB work or AES.
    // No-ops until Redis is configured (e.g. local dev).
    const ip = await getClientIp();
    if (!(await checkRateLimit("message", `msg:${ip}`))) {
      return { error: RATE_LIMIT_ERROR };
    }

    const { session } = await getSession();
    const senderId = session?.userId ?? null;

    if (receiverId === senderId) {
      return { error: "You can't send a message to yourself" };
    }

    if (senderId) {
      const blocked = await db.query.userBlockTable.findFirst({
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
      });

      if (blocked) {
        return { success: true };
      }
    }

    // Enforce the receiver's quiet mode server-side — the client toggle is a UI
    // hint, not a security boundary. Silently accept + drop (don't reveal the
    // state, mirroring the block path); also covers a non-existent receiverId.
    const receiver = await db.query.userTable.findFirst({
      columns: { quietMode: true },
      where: eq(userTable.id, receiverId),
    });

    if (!receiver || receiver.quietMode) {
      return { success: true };
    }

    // Encrypt only after the above checks so a dropped send does no crypto work.
    const encryptedContent = await aesEncrypt(formatContent(content));

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

    return { success: true };
  } catch (err) {
    console.log(err);
    return { error: "An error occurred" };
  }
}
