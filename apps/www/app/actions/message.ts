"use server";

import { db } from "@umamin/db";
import { messageTable, type SelectMessage } from "@umamin/db/schema/message";
import { userTable } from "@umamin/db/schema/user";
import { aesDecrypt, aesEncrypt } from "@umamin/encryption";
import { and, desc, eq, lt, or } from "drizzle-orm";
import { cacheLife } from "next/cache";
import { cache } from "react";
import * as z from "zod";
import { getSession } from "@/lib/auth";
import { formatContent } from "@/lib/utils";
import type { PublicUser } from "@/types/user";

type GetMessagesParams = {
  cursor?: string;
  type: "sent" | "received";
};

export const getMessagesAction = cache(
  async ({ cursor, type }: GetMessagesParams) => {
    "use cache: private";
    cacheLife({
      revalidate: 30,
    });

    try {
      const { session } = await getSession();

      if (!session) {
        throw new Error("Unauthorized");
      }

      const getData = async () => {
        // biome-ignore lint/suspicious/noImplicitAnyLet: drizzle
        let cursorCondition;

        if (cursor) {
          const sep = cursor.indexOf(".");
          if (sep > 0) {
            const ms = Number(cursor.slice(0, sep));
            const cursorId = cursor.slice(sep + 1);
            const cursorDate = new Date(ms);
            cursorCondition = or(
              lt(messageTable.createdAt, cursorDate),
              and(
                eq(messageTable.createdAt, cursorDate),
                lt(messageTable.id, cursorId),
              ),
            );
          }
        }

        const messageId =
          type === "received" ? messageTable.receiverId : messageTable.senderId;

        const baseCondition = eq(messageId, session.userId);
        const whereCondition = cursorCondition
          ? and(cursorCondition, baseCondition)
          : baseCondition;

        const rows = await db
          .select({
            message: messageTable,
            receiver: {
              id: userTable.id,
              username: userTable.username,
              displayName: userTable.displayName,
              imageUrl: userTable.imageUrl,
              quietMode: userTable.quietMode,
            },
          })
          .from(messageTable)
          .leftJoin(userTable, eq(messageTable.receiverId, userTable.id))
          .where(whereCondition)
          .orderBy(desc(messageTable.createdAt), desc(messageTable.id))
          .limit(20);

        const data = rows
          .filter((row) => row.receiver !== null)
          .map(({ message, receiver }) => ({
            ...message,
            receiver,
          }));

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
          messages: messagesData as (SelectMessage & {
            receiver: PublicUser;
          })[],
          nextCursor:
            messagesData.length === 20
              ? `${messagesData[messagesData.length - 1].createdAt?.getTime()}.${
                  messagesData[messagesData.length - 1].id
                }`
              : null,
        };
      };

      const result = await getData();
      return result;
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
