"use server";

import * as z from "zod";
import { cache } from "react";
import { db } from "@umamin/db";
import { and, desc, eq, lt, or } from "drizzle-orm";
import { aesDecrypt, aesEncrypt } from "@umamin/encryption";
import { messageTable } from "@umamin/db/schema/message";

import { Cursor } from "@/types";
import { getSession } from "@/lib/auth";
import { formatContent } from "@/lib/utils";

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
          lt(messageTable.createdAt, cursor.createdAt),
          and(
            eq(messageTable.createdAt, cursor.createdAt),
            lt(messageTable.id, cursor.id),
          ),
        );
      }

      const messageId =
        type === "received" ? messageTable.receiverId : messageTable.senderId;

      const data = await db.query.messageTable.findMany({
        where: and(cursorCondition, eq(messageId, session.userId)),
        with: {
          receiver: true,
        },
        orderBy: [desc(messageTable.createdAt), desc(messageTable.id)],
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
            try {
              const decryptedReply = await aesDecrypt(msg.reply);
              if (decryptedReply) {
                reply = decryptedReply;
              }
            } catch {
              reply = msg.reply;
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
      .delete(messageTable)
      .where(
        and(
          eq(messageTable.id, id),
          eq(messageTable.receiverId, session.userId),
        ),
      );

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

    return { success: true };
  } catch (err) {
    console.log(err);
    return { error: "An error occurred" };
  }
}
