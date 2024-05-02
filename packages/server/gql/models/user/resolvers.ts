import { eq } from "drizzle-orm";

import { db } from "../../../db";
import builder from "../../builder";
import { user } from "../../../db/schema";
import { UpdateUserInput } from "./types";

builder.queryFields((t) => ({
  currentUser: t.field({
    type: "User",
    nullable: true,
    resolve: (_root, _args, ctx) => ctx.currentUser,
  }),

  getUserByUsername: t.field({
    type: "User",
    nullable: true,
    args: {
      username: t.arg.string({ required: true }),
    },
    resolve: async (_root, { username }) => {
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
    type: "String",
    nullable: true,
    authScopes: {
      authenticated: true,
    },
    args: {
      input: t.arg({ type: UpdateUserInput, required: true }),
    },
    resolve: async (_root, args, ctx) => {
      try {
        await db
          .update(user)
          .set(args.input)
          .where(eq(user.id, ctx.currentUser.id));

        return "Success";
      } catch (err) {
        console.log(err);
        throw err;
      }
    },
  }),
}));
