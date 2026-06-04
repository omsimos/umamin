"use server";

import { db } from "@umamin/db";
import { noteReactionTable, noteTable } from "@umamin/db/schema/note";
import { and, eq, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import * as z from "zod";
import { getSession } from "@/lib/auth";
import { checkRateLimit, RATE_LIMIT_ERROR } from "@/lib/ratelimit";
import { getCurrentNoteData } from "@/lib/server/data";
import { formatContent } from "@/lib/utils";

const createNoteSchema = z.object({
  isAnonymous: z.boolean().default(false),
  content: z
    .string()
    .trim()
    .min(1, { error: "Content cannot be empty" })
    .max(500, { error: "Content cannot exceed 500 characters" }),
});

export async function createNoteAction(
  params: z.infer<typeof createNoteSchema>,
) {
  const result = createNoteSchema.safeParse(params);

  if (!result.success) {
    return { error: result.error.issues[0].message };
  }

  const { isAnonymous, content } = result.data;

  try {
    const { session } = await getSession();

    if (!session?.userId) {
      return { error: "User not authenticated" };
    }

    if (!(await checkRateLimit("write", `note:${session.userId}`))) {
      return { error: RATE_LIMIT_ERROR };
    }

    const formattedContent = formatContent(content);

    // Every submit rewrites the same note slot, so reactions from the previous
    // content no longer apply — reset them with the upsert.
    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(noteTable)
        .values({
          userId: session?.userId,
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
    updateTag("notes");

    return {
      success: true,
      note: await getCurrentNoteData(session.userId),
    };
  } catch (error) {
    console.log("Error creating note:", error);
    return { error: "Failed to create note" };
  }
}

export const getCurrentNoteAction = async () => {
  const { session } = await getSession();

  if (!session?.userId) {
    throw new Error("User not authenticated");
  }

  return getCurrentNoteData(session.userId);
};

export const clearNoteAction = async () => {
  try {
    const { session } = await getSession();

    if (!session?.userId) {
      return { error: "User not authenticated" };
    }

    if (!(await checkRateLimit("write", `note:${session.userId}`))) {
      return { error: RATE_LIMIT_ERROR };
    }

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
    updateTag("notes");

    return { success: true };
  } catch (error) {
    console.log("Error clearing note:", error);
    return { error: "Failed to clear note" };
  }
};

const noteIdSchema = z.string().min(1);

export async function addNoteReactionAction({ noteId }: { noteId: string }) {
  try {
    if (!noteIdSchema.safeParse(noteId).success) {
      return { error: "Invalid input" };
    }
    const { session } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

    if (!(await checkRateLimit("write", `notereact:${session.userId}`))) {
      return { error: RATE_LIMIT_ERROR };
    }

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

    // Skip the "notes" feed tag — reactionCount is eventually consistent there
    // (same contract as post likes); only the viewer's reacted state must be
    // read-your-writes.
    updateTag(`note:${noteId}:reacted:${session.userId}`);

    return result;
  } catch (err) {
    console.log(err);
    return { error: "An error occurred" };
  }
}

export async function removeNoteReactionAction({ noteId }: { noteId: string }) {
  try {
    if (!noteIdSchema.safeParse(noteId).success) {
      return { error: "Invalid input" };
    }
    const { session } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

    if (!(await checkRateLimit("write", `notereact:${session.userId}`))) {
      return { error: RATE_LIMIT_ERROR };
    }

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

    updateTag(`note:${noteId}:reacted:${session.userId}`);

    return result;
  } catch (err) {
    console.log(err);
    return { error: "An error occurred" };
  }
}
