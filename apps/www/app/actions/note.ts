"use server";

import * as z from "zod";
import { sql, desc, lt, and, or, eq } from "drizzle-orm";
import { db } from "@umamin/db";
import { getSession } from "@/lib/auth";
import { formatContent } from "@/lib/utils";
import { noteTable } from "@umamin/db/schema/note";
import { revalidateTag, unstable_cache } from "next/cache";
import { Cursor } from "@/types";

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

    // Invalidate notes cache entries
    revalidateTag("notes");
  } catch (error) {
    console.log("Error creating note:", error);
    return { error: "Failed to create note" };
  }
}

export async function getNotesAction({ cursor }: { cursor?: Cursor | null }) {
  try {
    const getCached = unstable_cache(
      async () => {
        let cursorCondition;
        if (cursor && cursor.date) {
          cursorCondition = or(
            lt(noteTable.updatedAt, cursor.date),
            and(
              eq(noteTable.updatedAt, cursor.date),
              lt(noteTable.id, cursor.id),
            ),
          );
        }

        const posts = await db.query.noteTable.findMany({
          with: {
            user: {
              columns: {
                id: true,
                username: true,
                displayName: true,
                imageUrl: true,
                quietMode: true,
              },
            },
          },
          where: cursorCondition,
          orderBy: [desc(noteTable.updatedAt), desc(noteTable.id)],
          limit: 10,
        });

        return {
          data: posts,
          nextCursor:
            posts.length === 10
              ? {
                  id: posts[posts.length - 1].id,
                  date: posts[posts.length - 1].updatedAt,
                }
              : null,
        };
      },
      [
        "notes",
        String(cursor?.id ?? ""),
        String(cursor?.date ? cursor.date.getTime() : ""),
      ],
      {
        revalidate: 30,
        tags: ["notes"],
      },
    );

    return await getCached();
  } catch (error) {
    console.log("Error fetching notes:", error);
    return { error: "Internal server error" };
  }
}
