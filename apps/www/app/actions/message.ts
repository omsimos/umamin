"use server";

import { db } from "@umamin/db";
import { messageTable } from "@umamin/db/schema/message";
import { userBlockTable } from "@umamin/db/schema/user";
import { aesEncrypt } from "@umamin/encryption";
import { and, eq, or } from "drizzle-orm";
import { updateTag } from "next/cache";
import * as z from "zod";
import { getSession } from "@/lib/auth";
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

    const encryptedReply = await aesEncrypt(params.data.content);

    await db
      .update(messageTable)
      .set({
        reply: encryptedReply,
      })
      .where(
        and(
          eq(messageTable.id, messageId),
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
    const { session } = await getSession();

    if (receiverId === session?.userId) {
      return { error: "You can't send a message to yourself" };
    }

    const formattedContent = formatContent(content);
    const encryptedContent = await aesEncrypt(formattedContent);

    const senderId = session?.userId ?? null;

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
