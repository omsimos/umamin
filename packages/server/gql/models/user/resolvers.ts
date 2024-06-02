import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { hash } from "@node-rs/argon2";
import { GraphQLError } from "graphql";

import { db } from "../../../db";
import builder from "../../builder";
import { user } from "../../../db/schema";
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
}));

builder.mutationFields((t) => ({
  createUser: t.field({
    type: "String",
    nullable: true,
    args: {
      username: t.arg.string({ required: true }),
      password: t.arg.string({ required: true }),
    },
    resolve: async (_, args) => {
      try {
        if (!/^[a-z0-9_-]+$/.test(args.username)) {
          throw new GraphQLError(
            "Username must be alphanumeric with no spaces.",
          );
        }

        const userId = nanoid();
        const passwordHash = await hash(args.password, {
          memoryCost: 19456,
          timeCost: 2,
          outputLen: 32,
          parallelism: 1,
        });

        await db.insert(user).values({
          id: userId,
          username: args.username,
          passwordHash,
        });

        return userId;
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
