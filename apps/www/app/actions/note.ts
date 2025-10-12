"use server";

import { db } from "@umamin/db";
import { noteTable } from "@umamin/db/schema/note";
import { eq, sql } from "drizzle-orm";
import { revalidateTag, unstable_cache } from "next/cache";
import * as z from "zod";
import { getSession } from "@/lib/auth";
import { formatContent } from "@/lib/utils";

const createNoteSchema = z.object({
  isAnonymous: z.boolean().default(false),
  content: z
    .string()
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

    const formattedContent = formatContent(content);

    await db
      .insert(noteTable)
      .values({
        userId: session?.userId,
        content: formattedContent,
        isAnonymous,
      })
      .onConflictDoUpdate({
        target: noteTable.userId,
        set: {
          content: formattedContent,
          isAnonymous,
          updatedAt: sql`(unixepoch())`,
        },
      });

    revalidateTag(`current-note:${session.userId}`);
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

  const getCachedData = unstable_cache(
    async () => {
      const [data] = await db
        .select()
        .from(noteTable)
        .where(eq(noteTable.userId, session.userId))
        .limit(1);

      return data;
    },
    ["api-current-note", session.userId],
    {
      tags: [`current-note:${session.userId}`],
    },
  );

  const result = await getCachedData();
  return result;
};

export const clearNoteAction = async () => {
  try {
    const { session } = await getSession();

    if (!session?.userId) {
      return { error: "User not authenticated" };
    }

    await db
      .update(noteTable)
      .set({ content: "" })
      .where(eq(noteTable.userId, session.userId));

    revalidateTag(`current-note:${session.userId}`);
  } catch (error) {
    console.log("Error clearing note:", error);
    return { error: "Failed to clear note" };
  }
};
