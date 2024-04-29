import { eq } from "drizzle-orm";

import { db } from "../../../db";
import builder from "../../builder";
import { user } from "../../../db/schema";

builder.queryFields((t) => ({
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
  hello: t.field({
    type: "String",
    args: {
      name: t.arg.string(),
    },
    resolve: async (_root, { name }) => {
      return `Hello, ${name || "World"}!`;
    },
  }),
}));
