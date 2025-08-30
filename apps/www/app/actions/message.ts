"use server";

import * as z from "zod";
import { cache } from "react";
import { db } from "@umamin/db/index";
import { message } from "@umamin/db/schema/message";
import { and, desc, eq, lt, or } from "drizzle-orm";

import { Cursor } from "@/types";
import { getSession } from "@/lib/auth";
import { aesDecrypt, aesEncrypt } from "@/lib/aes";

type GetMessagesParams = {
  cursor?: Cursor | null;
  type: "sent" | "received";
};

export const getMessagesAction = cache(
  async ({ cursor, type }: GetMessagesParams) => {
    try {
      const { session } = await getSession();

      if (!session) {
        throw new Error("Unauthorized");
      }

      let cursorCondition;

      if (cursor && cursor.createdAt) {
        cursorCondition = or(
          lt(message.createdAt, cursor.createdAt),
          and(
            eq(message.createdAt, cursor.createdAt),
            lt(message.id, cursor.id),
          ),
        );
      }

      const messageId =
        type === "received" ? message.receiverId : message.senderId;

      const data = await db.query.message.findMany({
        where: and(cursorCondition, eq(messageId, session.userId)),
        with: {
          receiver: true,
        },
        orderBy: [desc(message.createdAt), desc(message.id)],
        limit: 10,
      });

      const messagesData = await Promise.all(
        data.map(async (msg) => {
          let content: string;
          let reply: string | null = null;

          try {
            content = await aesDecrypt(msg.content);
          } catch {
            content = msg.content;
          }

          if (msg.reply) {
            const decryptedReply = await aesDecrypt(msg.reply);
            if (decryptedReply) {
              reply = decryptedReply;
            }
          }
          return {
            ...msg,
            content,
            reply,
          };
        }),
      );

      return {
        messages: messagesData,
        nextCursor:
          messagesData.length === 10
            ? {
                id: messagesData[messagesData.length - 1].id,
                createdAt: messagesData[messagesData.length - 1].createdAt,
              }
            : null,
      };
    } catch (err) {
      console.log(err);
      return { error: "An error occurred" };
    }
  },
);

export async function deleteMessageAction(id: string) {
  try {
    const { session } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

    await db
      .delete(message)
      .where(and(eq(message.id, id), eq(message.receiverId, session.userId)));

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
      .update(message)
      .set({
        reply: encryptedReply,
      })
      .where(
        and(eq(message.id, messageId), eq(message.receiverId, session.userId)),
      );

    return { success: true };
  } catch (err) {
    console.log(err);
    return { error: "An error occurred" };
  }
}

const sendMessageSchema = z.object({
  question: z.string().min(1).max(500),
  content: z.string().min(1).max(500),
  senderId: z.string().optional(),
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

    const { question, content, senderId, receiverId } = params.data;

    const formattedContent = content.replace(/(\r\n|\n|\r){2,}/g, "\n\n");
    const encryptedContent = await aesEncrypt(formattedContent);

    await db.insert(message).values({
      senderId,
      receiverId,
      question,
      content: encryptedContent,
    });

    return { success: true };
  } catch (err) {
    console.log(err);
    return { error: "An error occurred" };
  }
}
