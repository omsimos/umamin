import { db } from "@umamin/db";
import { messageTable, type SelectMessage } from "@umamin/db/schema/message";
import { userTable } from "@umamin/db/schema/user";
import { aesDecrypt } from "@umamin/encryption";
import { and, desc, eq, lt, or } from "drizzle-orm";
import { cacheLife } from "next/cache";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import type { PublicUser } from "@/types/user";

export async function GET(req: NextRequest) {
  try {
    const { session } = await getSession();

    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const cursor = searchParams.get("cursor");
    const typeParam = searchParams.get("type");
    const type = typeParam === "sent" ? "sent" : "received";

    const result = await (async () => {
      "use cache: private";
      cacheLife({ revalidate: 30 });

      // biome-ignore lint/suspicious/noImplicitAnyLet: drizzle cursor condition
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
    })();

    return Response.json(result);
  } catch (error) {
    console.error("Error fetching messages:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
