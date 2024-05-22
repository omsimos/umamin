import { and, desc, eq, lt, or, isNotNull } from "drizzle-orm";

import { db } from "../../../db";
import builder from "../../builder";
import { user } from "../../../db/schema";
import { UpdateUserInput, UsersWithNoteFromCursorInput } from "./types";

builder.queryFields((t) => ({
  currentUser: t.field({
    type: "User",
    nullable: true,
    resolve: (_, _args, ctx) => ctx.currentUser,
  }),

  userById: t.field({
    type: "User",
    nullable: true,
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_, args) => {
      try {
        const result = await db.query.user.findFirst({
          where: eq(user.id, args.id),
        });

        return result;
      } catch (err) {
        console.log(err);
        throw err;
      }
    },
  }),

  userByUsername: t.field({
    type: "User",
    nullable: true,
    args: {
      username: t.arg.string({ required: true }),
    },
    resolve: async (_, { username }) => {
      try {
        const result = await db.query.user.findFirst({
          where: eq(user.username, username),
        });

        return result;
      } catch (err) {
        console.log(err);
        throw err;
      }
    },
  }),

  usersWithNote: t.field({
    type: ["User"],
    nullable: true,
    resolve: async () => {
      try {
        const result = await db.query.user.findMany({
          where: isNotNull(user.note),
          orderBy: desc(user.updatedAt),
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
  updateUser: t.field({
    type: "User",
    authScopes: {
      authenticated: true,
    },
    args: {
      input: t.arg({ type: UpdateUserInput, required: true }),
    },
    resolve: async (_, args, ctx) => {
      try {
        const result = await db
          .update(user)
          .set(args.input)
          .where(eq(user.id, ctx.currentUser.id))
          .returning();

        return result[0];
      } catch (err) {
        console.log(err);
        throw err;
      }
    },
  }),

  updateNote: t.field({
    type: "User",
    authScopes: {
      authenticated: true,
    },
    args: {
      content: t.arg.string(),
    },
    resolve: async (_, args, ctx) => {
      try {
        const result = await db
          .update(user)
          .set({ note: args.content })
          .where(eq(user.id, ctx.currentUser.id))
          .returning();

        return result[0];
      } catch (err) {
        console.log(err);
        throw err;
      }
    },
  }),

  usersWithNoteFromCursor: t.field({
    type: "UsersWithCursor",
    args: {
      cursor: t.arg({ type: UsersWithNoteFromCursorInput, required: true }),
    },
    resolve: async (_, { cursor }) => {
      try {
        const result = await db.query.user.findMany({
          where: and(
            isNotNull(user.note),
            cursor
              ? or(
                  lt(user.updatedAt, cursor.updatedAt),
                  and(
                    eq(user.updatedAt, cursor.updatedAt),
                    lt(user.id, cursor.id),
                  ),
                )
              : undefined,
          ),
          limit: 5,
          orderBy: [desc(user.updatedAt), desc(user.id)],
        });

        return {
          data: result,
          cursor: {
            id: result[result.length - 1]?.id,
            updatedAt: result[result.length - 1]?.updatedAt,
            hasMore: result.length === 5,
          },
        };
      } catch (err) {
        console.log(err);
        throw err;
      }
    },
  }),
}));
