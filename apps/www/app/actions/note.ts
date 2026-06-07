"use server";

import { db } from "@umamin/db";
import { noteReactionTable, noteTable } from "@umamin/db/schema/note";
import { and, eq, sql } from "drizzle-orm";
import { revalidateTag, updateTag } from "next/cache";
import * as z from "zod";
import { getSession } from "@/lib/auth";
import { idSchema } from "@/lib/schema";
import { getCurrentNoteData } from "@/lib/server/data";
import { UNAUTHENTICATED_ERROR } from "@/lib/server/errors";
import { withAction } from "@/lib/server/with-action";
import { formatContent } from "@/lib/utils";

const createNoteSchema = z.object({
  isAnonymous: z.boolean().default(false),
  content: z
    .string()
    .trim()
    .min(1, { error: "Content cannot be empty" })
    .max(500, { error: "Content cannot exceed 500 characters" }),
});

export const createNoteAction = withAction(
  {
    schema: createNoteSchema,
    invalidInput: (error) => error.issues[0].message,
    authError: UNAUTHENTICATED_ERROR,
    rateLimit: {
      name: "write",
      key: ({ session }) => `note:${session.userId}`,
    },
    errorMessage: "Failed to create note",
  },
  async ({ isAnonymous, content }, { session }) => {
    const formattedContent = formatContent(content);

    // Every submit rewrites the same note slot, so reactions from the previous
    // content no longer apply — reset them with the upsert.
    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(noteTable)
        .values({
          userId: session.userId,
          content: formattedContent,
          isAnonymous,
          reactionCount: 0,
          // updated_at is the notes-feed sort key + pagination cursor. Set it on
          // insert (it has no SQL default) so new notes sort to the top and never
          // produce a NULL -> NaN cursor.
          updatedAt: sql`(unixepoch())`,
        })
        .onConflictDoUpdate({
          target: noteTable.userId,
          set: {
            content: formattedContent,
            isAnonymous,
            reactionCount: 0,
            updatedAt: sql`(unixepoch())`,
          },
        })
        .returning({ id: noteTable.id });

      if (row) {
        await tx
          .delete(noteReactionTable)
          .where(eq(noteReactionTable.noteId, row.id));
      }
    });

    updateTag(`current-note:${session.userId}`);
    // Background SWR (see createPostAction): the author already gets
    // read-your-writes from the optimistic cache upsert + current-note tag, so
    // no request should block on a shared feed recompute.
    revalidateTag("notes", "max");

    return {
      success: true,
      note: await getCurrentNoteData(session.userId),
    };
  },
);

export const getCurrentNoteAction = async () => {
  const { session } = await getSession();

  if (!session?.userId) {
    throw new Error("User not authenticated");
  }

  return getCurrentNoteData(session.userId);
};

export const clearNoteAction = withAction(
  {
    authError: UNAUTHENTICATED_ERROR,
    rateLimit: {
      name: "write",
      key: ({ session }) => `note:${session.userId}`,
    },
    errorMessage: "Failed to clear note",
  },
  async (_input, { session }) => {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .update(noteTable)
        .set({ content: "", reactionCount: 0 })
        .where(eq(noteTable.userId, session.userId))
        .returning({ id: noteTable.id });

      if (row) {
        await tx
          .delete(noteReactionTable)
          .where(eq(noteReactionTable.noteId, row.id));
      }
    });

    updateTag(`current-note:${session.userId}`);
    revalidateTag("notes", "max");

    return { success: true };
  },
);

export const addNoteReactionAction = withAction(
  {
    schema: z.object({ noteId: idSchema }),
    rateLimit: {
      name: "write",
      key: ({ session }) => `notereact:${session.userId}`,
    },
  },
  async ({ noteId }, { session }) => {
    const result = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(noteReactionTable)
        .values({ noteId, userId: session.userId })
        .onConflictDoNothing()
        .returning({ id: noteReactionTable.id });

      if (inserted.length === 0) {
        return { success: true, alreadyReacted: true };
      }

      await tx
        .update(noteTable)
        .set({ reactionCount: sql`${noteTable.reactionCount} + 1` })
        .where(eq(noteTable.id, noteId));

      return { success: true };
    });

    // Per-viewer tag only: counts are eventually consistent in the shared feed
    // (<=120s, same contract as post likes). The notes shell is static and the
    // client cache is viewer-keyed, so rehydration can't clobber optimistic UI.
    updateTag(`note:${noteId}:reacted:${session.userId}`);

    return result;
  },
);

export const removeNoteReactionAction = withAction(
  {
    schema: z.object({ noteId: idSchema }),
    rateLimit: {
      name: "write",
      key: ({ session }) => `notereact:${session.userId}`,
    },
  },
  async ({ noteId }, { session }) => {
    const result = await db.transaction(async (tx) => {
      const removed = await tx
        .delete(noteReactionTable)
        .where(
          and(
            eq(noteReactionTable.noteId, noteId),
            eq(noteReactionTable.userId, session.userId),
          ),
        )
        .returning({ id: noteReactionTable.id });

      if (removed.length === 0) {
        return { success: true, alreadyRemoved: true };
      }

      await tx
        .update(noteTable)
        .set({
          reactionCount: sql`CASE WHEN ${noteTable.reactionCount} > 0 THEN ${noteTable.reactionCount} - 1 ELSE 0 END`,
        })
        .where(eq(noteTable.id, noteId));

      return { success: true };
    });

    // See addNoteReactionAction — per-viewer tag only.
    updateTag(`note:${noteId}:reacted:${session.userId}`);

    return result;
  },
);
