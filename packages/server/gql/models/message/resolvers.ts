import { nanoid } from "nanoid";
import { and, desc, eq, gt } from "drizzle-orm";

import { db } from "../../../db";
import builder from "../../builder";
import { CreateMessageInput } from "./types";
import { message } from "../../../db/schema";

builder.queryFields((t) => ({
  messages: t.field({
    type: ["Message"],
    args: {
      userId: t.arg.string({ required: true }),
      type: t.arg.string({ required: true }), // "recent" || "sent"
      cursorId: t.arg.string(),
    },
    resolve: async (_root, { userId, type, cursorId }) => {
      try {
        if (!["recent", "sent"].includes(type)) {
          throw new Error("Invalid message type");
        }

        const result = await db.query.message.findMany({
          where: and(
            type === "recent"
              ? eq(message.userId, userId)
              : eq(message.senderId, userId),
            cursorId ? gt(message.id, cursorId) : undefined,
          ),
          limit: 5,
          orderBy: [desc(message.createdAt)],
          with:
            type === "sent"
              ? {
                  user: true,
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
    resolve: async (_root, { input }) => {
      try {
        const result = await db
          .insert(message)
          .values({ id: nanoid(), ...input })
          .returning();

        return result[0];
      } catch (err) {
        console.log(err);
        throw err;
      }
    },
  }),
}));
