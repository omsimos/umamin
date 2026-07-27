import { noteReactionTable, noteTable } from "@umamin/db/schema/note";
import { and, eq, sql } from "drizzle-orm";
import * as z from "zod";
import { parseMusicUrl } from "../../lib/music";
import { action } from "../../server-lib/action";
import { formatContent } from "../../server-lib/content";
import { getCurrentNoteData } from "../../server-lib/data";
import { UNAUTHENTICATED_ERROR } from "../../server-lib/errors";
import { isModerator } from "../../server-lib/moderation";
import { fetchMusicMeta } from "../../server-lib/music-meta";
import { idSchema } from "../../server-lib/schema";
import { ctxDb } from "./_shared";

const createNoteSchema = z
  .object({
    isAnonymous: z.boolean().default(false),
    content: z
      .string()
      .trim()
      .max(500, { error: "Content cannot exceed 500 characters" })
      .default(""),
    musicUrl: z.string().trim().max(2048).optional(),
  })
  .refine((v) => v.content.length > 0 || !!v.musicUrl, {
    error: "Add a few words or a song.",
  })
  .refine((v) => !v.musicUrl || parseMusicUrl(v.musicUrl) !== null, {
    error: "That doesn't look like a supported song link.",
  });

export const createNoteHandler = action(
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
  async ({ isAnonymous, content, musicUrl }, { session, c }) => {
    const db = ctxDb(c);
    const formattedContent = formatContent(content);

    const music = musicUrl ? parseMusicUrl(musicUrl) : null;
    const { title: musicTitle, thumbnail: musicThumbnail } = music
      ? await fetchMusicMeta(music)
      : { title: null, thumbnail: null };

    const musicProvider = music?.provider ?? null;
    const musicId = music?.id ?? null;

    const legacyMusic = {
      spotifyTrackId: null,
      spotifyTitle: null,
      spotifyThumbnail: null,
    };

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

    return {
      success: true,
      note: await getCurrentNoteData(db, session.userId),
    };
  },
);

export const getCurrentNoteHandler = action(
  { authError: UNAUTHENTICATED_ERROR },
  (_input, { session, c }) => getCurrentNoteData(ctxDb(c), session.userId),
);

export const clearNoteHandler = action(
  {
    authError: UNAUTHENTICATED_ERROR,
    rateLimit: {
      name: "write",
      key: ({ session }) => `note:${session.userId}`,
    },
    errorMessage: "Failed to clear note",
  },
  async (_input, { session, c }) => {
    const db = ctxDb(c);
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

    return { success: true };
  },
);

export const removeNoteHandler = action(
  {
    schema: z.object({ noteId: idSchema }),
    authError: UNAUTHENTICATED_ERROR,
    rateLimit: {
      name: "write",
      key: ({ session }) => `modnote:${session.userId}`,
    },
    errorMessage: "Failed to remove note",
  },
  async ({ noteId }, { user, c }) => {
    const db = ctxDb(c);
    if (!isModerator(user, c.env.MODERATOR_USERS)) {
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

    return { success: true };
  },
);

export const addNoteReactionHandler = action(
  {
    schema: z.object({ noteId: idSchema }),
    rateLimit: {
      name: "write",
      key: ({ session }) => `notereact:${session.userId}`,
    },
  },
  async ({ noteId }, { session, c }) => {
    const db = ctxDb(c);
    return db.transaction(async (tx) => {
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
  },
);

export const removeNoteReactionHandler = action(
  {
    schema: z.object({ noteId: idSchema }),
    rateLimit: {
      name: "write",
      key: ({ session }) => `notereact:${session.userId}`,
    },
  },
  async ({ noteId }, { session, c }) => {
    const db = ctxDb(c);
    return db.transaction(async (tx) => {
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
  },
);
