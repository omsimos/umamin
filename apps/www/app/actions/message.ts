"use server";

import { db } from "@umamin/db";
import { messageTable } from "@umamin/db/schema/message";
import { aesEncrypt } from "@umamin/encryption";
import { and, eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import * as z from "zod";
import { getSession } from "@/lib/auth";
import { formatContent } from "@/lib/utils";

export async function deleteMessageAction(id: string) {
  try {
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
    const { session } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

    const encryptedReply = await aesEncrypt(content);

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
  question: z.string().min(1).max(500),
  content: z.string().min(1).max(500),
  receiverId: z.string(),
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
