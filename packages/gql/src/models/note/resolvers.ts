import { nanoid } from "nanoid";
import { db, and, desc, eq, lt, or } from "@umamin/db";

import builder from "../../builder";
import { note } from "@umamin/db/schema/note";
import { NotesFromCursorInput } from "./types";

builder.queryFields((t) => ({
  noteByUserId: t.field({
    type: "Note",
    nullable: true,
    args: {
      userId: t.arg.string({ required: true }),
    },
    resolve: async (_, args) => {
      try {
        const result = await db.query.note.findFirst({
          where: eq(note.userId, args.userId),
          with: {
            user: true,
          },
        });

        return result;
      } catch (err) {
        console.log(err);
        throw err;
      }
    },
  }),

  notes: t.field({
    type: ["Note"],
    resolve: async () => {
      try {
        const result = await db.query.note.findMany({
          orderBy: desc(note.updatedAt),
          limit: 10,
          with: {
            user: true,
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
  updateNote: t.field({
    type: "Note",
    authScopes: {
      authenticated: true,
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
        const result = await db
          .insert(note)
          .values({
            id: nanoid(),
            userId: ctx.userId,
            content,
            isAnonymous,
          })
          .onConflictDoUpdate({
            target: note.userId,
            set: {
              content,
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
        const result = await db.query.note.findMany({
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
          orderBy: [desc(note.updatedAt), desc(note.id)],
        });

        return {
          data: result,
          hasMore: result.length === 10,
          cursor: {
            id: result[result.length - 1]?.id,
            updatedAt: result[result.length - 1]?.updatedAt,
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
    args: {
      userId: t.arg.string({ required: true }),
    },
    resolve: async (_, args) => {
      try {
        await db.delete(note).where(eq(note.userId, args.userId)).returning();

        return "Success";
      } catch (err) {
        console.log(err);
        throw err;
      }
    },
  }),
}));
