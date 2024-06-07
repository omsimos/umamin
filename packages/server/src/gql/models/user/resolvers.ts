import { eq } from "drizzle-orm";
import { GraphQLError } from "graphql";

import { db } from "@server/db";
import { user } from "@server/db/schema";
import { UpdateUserInput } from "./types";
import builder from "@server/gql/builder";

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
          with: {
            profile: true,
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
      try {
        const result = await db
          .update(user)
          .set(args.input)
          .where(eq(user.id, ctx.currentUser.id))
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
