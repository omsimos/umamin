import { db, eq } from "@umamin/db";
import { GraphQLError } from "graphql";
import { user } from "@umamin/db/schema/user";

import builder from "../../builder";
import { UpdateUserInput } from "./types";

builder.queryFields((t) => ({
  userByUsername: t.field({
    type: "User",
    nullable: true,
    args: {
      username: t.arg.string({ required: true }),
    },
    resolve: async (_, args) => {
      try {
        const result = await db.query.user.findFirst({
          where: eq(user.username, args.username),
          with: {
            note: true,
          },
        });

        return result;
      } catch (err) {
        console.log(err);
        throw err;
      }
    },
  }),

  currentUser: t.field({
    type: "User",
    authScopes: {
      authenticated: true,
    },
    nullable: true,
    resolve: async (_, _args, ctx) => {
      if (!ctx.userId) {
        throw new GraphQLError("Unauthorized");
      }

      try {
        const result = await db.query.user.findFirst({
          where: eq(user.id, ctx.userId),
          with: {
            accounts: true,
          },
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
      if (!ctx.userId) {
        throw new GraphQLError("Unauthorized");
      }

      try {
        const result = await db
          .update(user)
          .set(args.input)
          .where(eq(user.id, ctx.userId))
          .returning();

        return result[0]!;
      } catch (err: any) {
        console.log(err);

        if (err.code === "SQLITE_CONSTRAINT") {
          if (err.message.includes("user.username")) {
            throw new GraphQLError("Username is already taken.");
          }
        }
        throw err;
      }
    },
  }),
}));
