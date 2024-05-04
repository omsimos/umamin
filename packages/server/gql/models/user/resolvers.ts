import { eq } from "drizzle-orm";

import { db } from "../../../db";
import builder from "../../builder";
import { user } from "../../../db/schema";
import { UpdateUserInput } from "./types";

builder.queryFields((t) => ({
  currentUser: t.field({
    type: "User",
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
}));
