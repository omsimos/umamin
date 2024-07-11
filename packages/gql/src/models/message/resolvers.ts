import { nanoid } from "nanoid";
import { GraphQLError } from "graphql";
import { db, and, desc, eq, lt, or } from "@umamin/db";

import builder from "../../builder";
import { message } from "@umamin/db/schema/message";
import { aesEncrypt, aesDecrypt } from "@umamin/aes";
import { CreateMessageInput, MessagesFromCursorInput } from "./types";

builder.queryFields((t) => ({
  messages: t.field({
    type: ["Message"],
    nullable: false,
    authScopes: { authenticated: true },
    directives: {
      rateLimit: { limit: 5, duration: 20 },
    },
    args: {
      type: t.arg.string({ required: true }),
    },
    resolve: async (_, { type }, ctx) => {
      if (!ctx.userId) {
        throw new GraphQLError("Unauthorized");
      }

      if (!["received", "sent"].includes(type)) {
        throw new GraphQLError("Invalid message type");
      }

      try {
        const _result = await db.query.message.findMany({
          where:
            type === "received"
              ? eq(message.receiverId, ctx.userId)
              : eq(message.senderId, ctx.userId),
          limit: 10,
          orderBy: [desc(message.createdAt)],
          with:
            type === "sent"
              ? {
                  receiver: true,
                }
              : undefined,
        });

        const result = _result.map(async (msg) => {
          const decryptedContent = await aesDecrypt(msg.content);
          if (decryptedContent) {
            msg.content = decryptedContent;
          }

          if (msg.reply) {
            const decryptedReply = await aesDecrypt(msg.reply);
            if (decryptedReply) {
              msg.reply = decryptedReply;
            }
          }

          return msg;
        });

        const res = await Promise.all(result);

        return res;
      } catch (err) {
        console.log(err);
        throw err;
      }
    },
  }),

  messagesFromCursor: t.field({
    type: "MessagesWithCursor",
    nullable: false,
    authScopes: { authenticated: true },
    directives: {
      rateLimit: { limit: 5, duration: 20 },
    },
    args: {
      input: t.arg({ type: MessagesFromCursorInput, required: true }),
    },
    resolve: async (_, { input }, ctx) => {
      const { type, cursor } = input;

      if (!ctx.userId) {
        throw new GraphQLError("Unauthorized");
      }

      if (!["received", "sent"].includes(type)) {
        throw new GraphQLError("Invalid message type");
      }

      if (!cursor?.id || !cursor.createdAt) {
        return {
          data: null,
          hasMore: false,
          cursor: null,
        };
      }

      try {
        const _result = await db.query.message.findMany({
          where: and(
            type === "received"
              ? eq(message.receiverId, ctx.userId)
              : eq(message.senderId, ctx.userId),

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

        const result = _result.map(async (msg) => {
          const decryptedContent = await aesDecrypt(msg.content);
          if (decryptedContent) {
            msg.content = decryptedContent;
          }

          return msg;
        });

        const res = await Promise.all(result);

        return {
          data: res,
          hasMore: res.length === 5,
          cursor: {
            id: res[res.length - 1]?.id,
            createdAt: res[res.length - 1]?.createdAt,
          },
        };
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
    directives: {
      rateLimit: { limit: 3, duration: 20 },
    },
    args: {
      input: t.arg({ type: CreateMessageInput, required: true }),
    },
    resolve: async (_, { input }) => {
      try {
        const content = input.content.replace(/(\r\n|\n|\r){2,}/g, "\n\n");

        const encryptedContent = await aesEncrypt(content);

        const result = await db
          .insert(message)
          .values({ id: nanoid(), ...input, content: encryptedContent })
          .returning();

        return result[0]!;
      } catch (err) {
        console.log(err);
        throw err;
      }
    },
  }),

  createReply: t.field({
    type: "String",
    authScopes: { authenticated: true },
    directives: {
      rateLimit: { limit: 3, duration: 20 },
    },
    args: {
      messageId: t.arg.string({ required: true }),
      content: t.arg.string({
        required: true,
        validate: { minLength: 1, maxLength: 500 },
      }),
    },
    resolve: async (_, args) => {
      try {
        const content = args.content.replace(/(\r\n|\n|\r){2,}/g, "\n\n");

        const encryptedContent = await aesEncrypt(content);

        await db
          .update(message)
          .set({ reply: encryptedContent })
          .where(eq(message.id, args.messageId));

        return "Success";
      } catch (err) {
        console.log(err);
        throw err;
      }
    },
  }),

  deleteMessage: t.field({
    type: "String",
    authScopes: { authenticated: true },
    directives: {
      rateLimit: { limit: 3, duration: 20 },
    },
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
