"use server";

import { db } from "@umamin/db";
import { noteReactionTable, noteTable } from "@umamin/db/schema/note";
import { and, eq, sql } from "drizzle-orm";
import { revalidateTag, updateTag } from "next/cache";
import * as z from "zod";
import { getSession } from "@/lib/auth";
import { parseMusicUrl } from "@/lib/music";
import { idSchema } from "@/lib/schema";
import { getCurrentNoteData } from "@/lib/server/data";
import { UNAUTHENTICATED_ERROR } from "@/lib/server/errors";
import { isModerator } from "@/lib/server/moderation";
import { fetchMusicMeta } from "@/lib/server/music";
import { withAction } from "@/lib/server/with-action";
import { formatContent } from "@/lib/utils";

const createNoteSchema = z
  .object({
    isAnonymous: z.boolean().default(false),
    content: z
      .string()
      .trim()
      .max(500, { error: "Content cannot exceed 500 characters" })
      .default(""),
    // Optional song link from any supported platform (spotify/apple/soundcloud/
    // youtube); the server is the source of truth for parsing/validating it (the
    // client only pre-checks for instant feedback). Apple Music URLs can be long.
    musicUrl: z.string().trim().max(2048).optional(),
  })
  // A note may be text-only, song-only, or both — but never empty.
  .refine((v) => v.content.length > 0 || !!v.musicUrl, {
    error: "Add a few words or a song.",
  })
  .refine((v) => !v.musicUrl || parseMusicUrl(v.musicUrl) !== null, {
    error: "That doesn't look like a supported song link.",
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
  async ({ isAnonymous, content, musicUrl }, { session }) => {
    const formattedContent = formatContent(content);

    // The refine above guarantees a present musicUrl parses. Resolve metadata
    // BEFORE the transaction so a slow oEmbed never holds it open; a null ref
    // (no song / cleared) wipes any previously attached song.
    const music = musicUrl ? parseMusicUrl(musicUrl) : null;
    const { title: musicTitle, thumbnail: musicThumbnail } = music
      ? await fetchMusicMeta(music)
      : { title: null, thumbnail: null };

    const musicProvider = music?.provider ?? null;
    const musicId = music?.id ?? null;

    // New code stops writing the legacy spotify_* columns; null them on every
    // save so re-saving a pre-5.24.0 note clears its old values.
    const legacyMusic = {
      spotifyTrackId: null,
      spotifyTitle: null,
      spotifyThumbnail: null,
    };

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
          musicProvider,
          musicId,
          musicTitle,
          musicThumbnail,
          ...legacyMusic,
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
            musicProvider,
            musicId,
            musicTitle,
            musicThumbnail,
            ...legacyMusic,
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
        .set({
          content: "",
          reactionCount: 0,
          musicProvider: null,
          musicId: null,
          musicTitle: null,
          musicThumbnail: null,
          spotifyTrackId: null,
          spotifyTitle: null,
          spotifyThumbnail: null,
        })
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

// Maintainer-only removal of another user's note. Unlike clearNoteAction (which
// blanks the actor's own note slot in place), this hard-deletes the row so it
// leaves the public feed outright; reactions cascade via the note FK, but we
// clear them explicitly to mirror clearNoteAction and not lean on FK behavior.
export const removeNoteAction = withAction(
  {
    schema: z.object({ noteId: idSchema }),
    authError: UNAUTHENTICATED_ERROR,
    rateLimit: {
      name: "write",
      key: ({ session }) => `modnote:${session.userId}`,
    },
    errorMessage: "Failed to remove note",
  },
  async ({ noteId }, { user }) => {
    // Return the same "not found" string whether the caller lacks the role or
    // the note is gone — don't leak which.
    if (!isModerator(user)) {
      return { error: "Note not found" };
    }

    const [note] = await db
      .select({ id: noteTable.id, userId: noteTable.userId })
      .from(noteTable)
      .where(eq(noteTable.id, noteId))
      .limit(1);

    if (!note) {
      return { error: "Note not found" };
    }

    await db.transaction(async (tx) => {
      await tx
        .delete(noteReactionTable)
        .where(eq(noteReactionTable.noteId, noteId));
      await tx.delete(noteTable).where(eq(noteTable.id, noteId));
    });

    // Key the author's own note-slot cache, not the moderator's.
    updateTag(`current-note:${note.userId}`);
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
