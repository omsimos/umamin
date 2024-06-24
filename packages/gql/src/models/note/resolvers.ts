import { nanoid } from "nanoid";
import { GraphQLError } from "graphql";
import { aesDecrypt, aesEncrypt } from "@umamin/aes";
import { db, and, desc, eq, lt, or } from "@umamin/db";

import builder from "../../builder";
import { note } from "@umamin/db/schema/note";
import { NotesFromCursorInput } from "./types";

builder.queryFields((t) => ({
  note: t.field({
    type: "Note",
    authScopes: { authenticated: true },
    directives: {
      rateLimit: { limit: 5, duration: 20 },
    },
    nullable: true,
    resolve: async (_, _args, ctx) => {
      if (!ctx.userId) {
        throw new GraphQLError("Unauthorized");
      }

      try {
        const result = await db.query.note.findFirst({
          where: eq(note.userId, ctx.userId),
        });

        const decryptedText = await aesDecrypt(result?.content ?? "");

        if (result && decryptedText) {
          result.content = decryptedText;
        }

        return result;
      } catch (err) {
        console.log(err);
        throw err;
      }
    },
  }),

  notes: t.field({
    type: ["Note"],
    directives: {
      rateLimit: { limit: 5, duration: 20 },
    },
    resolve: async () => {
      try {
        const _result = await db.query.note.findMany({
          orderBy: desc(note.updatedAt),
          limit: 10,
          with: {
            user: true,
          },
        });

        const result = _result.map(async (note) => {
          const decryptedText = await aesDecrypt(note.content);

          if (note.isAnonymous) {
            note.user = null!;
          }

          if (decryptedText) {
            note.content = decryptedText;
          }

          return note;
        });

        const res = await Promise.all(result);

        return res;
      } catch (err) {
        console.log(err);
        throw err;
      }
    },
  }),
}));

builder.mutationFields((t) => ({
  updateNote: t.field({
    type: "Note",
    authScopes: {
      authenticated: true,
    },
    directives: {
      rateLimit: { limit: 3, duration: 20 },
    },
    args: {
      content: t.arg.string({ required: true }),
      isAnonymous: t.arg.boolean({ required: true }),
    },
    resolve: async (_, { content, isAnonymous }, ctx) => {
      if (!ctx.userId) {
        throw new Error("Unauthorized");
      }

      try {
        const encryptedContent = await aesEncrypt(content);

        const result = await db
          .insert(note)
          .values({
            id: nanoid(),
            userId: ctx.userId,
            content: encryptedContent,
            isAnonymous,
          })
          .onConflictDoUpdate({
            target: note.userId,
            set: {
              content: encryptedContent,
              isAnonymous,
            },
          })
          .returning();

        return result[0]!;
      } catch (err) {
        console.log(err);
        throw err;
      }
    },
  }),

  notesFromCursor: t.field({
    type: "NotesWithCursor",
    directives: {
      rateLimit: { limit: 5, duration: 20 },
    },
    args: {
      cursor: t.arg({ type: NotesFromCursorInput, required: true }),
    },
    resolve: async (_, { cursor }) => {
      if (!cursor?.id || !cursor.updatedAt) {
        return {
          data: null,
          hasMore: false,
          cursor: null,
        };
      }

      try {
        const _result = await db.query.note.findMany({
          where: cursor
            ? or(
                lt(note.updatedAt, cursor.updatedAt),
                and(
                  eq(note.updatedAt, cursor.updatedAt),
                  lt(note.id, cursor.id),
                ),
              )
            : undefined,
          limit: 10,
          with: { user: true },
          orderBy: [desc(note.updatedAt), desc(note.id)],
        });

        const result = _result.map(async (note) => {
          const decryptedText = await aesDecrypt(note.content);

          if (note.isAnonymous) {
            note.user = null!;
          }

          if (decryptedText) {
            note.content = decryptedText;
          }

          return note;
        });

        const res = await Promise.all(result);

        return {
          data: res,
          hasMore: res.length === 10,
          cursor: {
            id: res[result.length - 1]?.id,
            updatedAt: res[result.length - 1]?.updatedAt,
          },
        };
      } catch (err) {
        console.log(err);
        throw err;
      }
    },
  }),

  deleteNote: t.field({
    type: "String",
    authScopes: {
      authenticated: true,
    },
    directives: {
      rateLimit: { limit: 3, duration: 20 },
    },
    resolve: async (_, _args, ctx) => {
      if (!ctx.userId) {
        throw new GraphQLError("Unauthorized");
      }

      try {
        await db.delete(note).where(eq(note.userId, ctx.userId));

        return "Success";
      } catch (err) {
        console.log(err);
        throw err;
      }
    },
  }),
}));
