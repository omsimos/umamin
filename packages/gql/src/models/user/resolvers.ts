import { db, eq } from "@umamin/db";
import { GraphQLError } from "graphql";
import { user } from "@umamin/db/schema/user";

import builder from "../../builder";
import { UpdateUserInput } from "./types";

builder.queryFields((t) => ({
  user: t.field({
    type: "User",
    authScopes: {
      authenticated: true,
    },
    directives: {
      rateLimit: { limit: 5, duration: 20 },
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

  userByUsername: t.field({
    type: "PublicUser",
    nullable: true,
    directives: {
      rateLimit: { limit: 5, duration: 20 },
    },
    args: {
      username: t.arg.string({ required: true }),
    },
    resolve: async (_, args) => {
      try {
        const result = await db.query.user.findFirst({
          where: eq(user.username, args.username),
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
    directives: {
      rateLimit: { limit: 5, duration: 20 },
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
