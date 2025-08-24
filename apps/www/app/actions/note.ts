"use server";

import * as z from "zod";
import { db } from "@umamin/db/index";
import { getSession } from "@/lib/auth";
import { noteTable } from "@umamin/db/schema/note";
import { sql } from "drizzle-orm";

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

    const modifiedContent = content.replace(/(\r\n|\n|\r){2,}/g, "\n\n");

    await db
      .insert(noteTable)
      .values({
        userId: session?.userId,
        content: modifiedContent,
        isAnonymous,
      })
      .onConflictDoUpdate({
        target: noteTable.userId,
        set: {
          content: modifiedContent,
          isAnonymous,
          updatedAt: sql`(unixepoch())`,
        },
      });
  } catch (error) {
    console.log("Error creating note:", error);
    return { error: "Failed to create note" };
  }
}
