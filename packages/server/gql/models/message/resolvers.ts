import { nanoid } from "nanoid";
import { and, desc, eq, lt, or } from "drizzle-orm";

import { db } from "../../../db";
import builder from "../../builder";
import { message } from "../../../db/schema";
import { CreateMessageInput, MessagesFromCursorInput } from "./types";

builder.queryFields((t) => ({
  messages: t.field({
    type: ["Message"],
    args: {
      userId: t.arg.string({ required: true }),
      type: t.arg.string({ required: true }), // "received" || "sent"
    },
    resolve: async (_, { userId, type }) => {
      try {
        if (!["received", "sent"].includes(type)) {
          throw new Error("Invalid message type");
        }

        const result = await db.query.message.findMany({
          where:
            type === "received"
              ? eq(message.receiverId, userId)
              : eq(message.senderId, userId),
          limit: 5,
          orderBy: [desc(message.createdAt)],
          with:
            type === "sent"
              ? {
                  receiver: true,
                }
              : undefined,
        });

        return result;
      } catch (err) {
        console.log(err);
        throw err;
      }
    },
  }),
}));

builder.mutationFields((t) => ({
  createMessage: t.field({
    type: "Message",
    args: {
      input: t.arg({ type: CreateMessageInput, required: true }),
    },
    resolve: async (_, { input }) => {
      try {
        const result = await db
          .insert(message)
          .values({ id: nanoid(), ...input })
          .returning();

        return result[0]!;
      } catch (err) {
        console.log(err);
        throw err;
      }
    },
  }),

  messagesFromCursor: t.field({
    type: "MessagesWithCursor",
    authScopes: { authenticated: true },
    args: {
      input: t.arg({ type: MessagesFromCursorInput, required: true }),
    },
    resolve: async (_, { input }, ctx) => {
      const { type, cursor } = input;

      if (!cursor?.id || !cursor.createdAt) {
        return {
          data: null,
          hasMore: false,
          cursor: null,
        };
      }

      try {
        if (!["received", "sent"].includes(type)) {
          throw new Error("Invalid message type");
        }

        const result = await db.query.message.findMany({
          where: and(
            type === "received"
              ? eq(message.receiverId, ctx.currentUser.id)
              : eq(message.senderId, ctx.currentUser.id),

            cursor
              ? or(
                  lt(message.createdAt, cursor.createdAt),
                  and(
                    eq(message.createdAt, cursor.createdAt),
                    lt(message.id, cursor.id),
                  ),
                )
              : undefined,
          ),
          limit: 5,
          orderBy: [desc(message.createdAt), desc(message.id)],
          with:
            type === "sent"
              ? {
                  receiver: true,
                }
              : undefined,
        });

        return {
          data: result,
          hasMore: result.length === 5,
          cursor: {
            id: result[result.length - 1]?.id,
            createdAt: result[result.length - 1]?.createdAt,
          },
        };
      } catch (err) {
        console.log(err);
        throw err;
      }
    },
  }),

  deleteMessage: t.field({
    type: "String",
    authScopes: { authenticated: true },
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_, args) => {
      try {
        await db.delete(message).where(eq(message.id, args.id));

        return "Success";
      } catch (err) {
        console.log(err);
        throw err;
      }
    },
  }),
}));
