import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

import { userTable } from "./user";

export const noteTable = sqliteTable(
  "note",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text("user_id").unique().notNull(),
    content: text("content").notNull(),
    isAnonymous: integer("is_anonymous", { mode: "boolean" }).notNull(),
    reactionCount: integer("reaction_count").notNull().default(0),
    // Optional embedded Spotify track. Only the id is authoritative (validated
    // server-side); title + thumbnail are best-effort oEmbed metadata cached for
    // the feed preview. All null when no song is attached.
    spotifyTrackId: text("spotify_track_id"),
    spotifyTitle: text("spotify_title"),
    spotifyThumbnail: text("spotify_thumbnail"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$onUpdate(
      () => new Date(),
    ),
  },
  (t) => [index("updated_at_id_idx").on(t.updatedAt, t.id)],
);

export const noteReactionTable = sqliteTable(
  "note_reaction",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    noteId: text("note_id")
      .notNull()
      .references(() => noteTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("note_reaction_note_user_uidx").on(t.noteId, t.userId),
    // Backs the per-viewer overlay query (userId = ? AND noteId IN (...)).
    index("note_reaction_user_note_idx").on(t.userId, t.noteId),
  ],
);

export const noteRelations = relations(noteTable, ({ one }) => ({
  user: one(userTable, {
    fields: [noteTable.userId],
    references: [userTable.id],
  }),
}));

export const noteReactionRelations = relations(
  noteReactionTable,
  ({ one }) => ({
    note: one(noteTable, {
      fields: [noteReactionTable.noteId],
      references: [noteTable.id],
    }),
    user: one(userTable, {
      fields: [noteReactionTable.userId],
      references: [userTable.id],
    }),
  }),
);

export type InsertNote = typeof noteTable.$inferInsert;
export type SelectNote = typeof noteTable.$inferSelect;
export type InsertNoteReaction = typeof noteReactionTable.$inferInsert;
export type SelectNoteReaction = typeof noteReactionTable.$inferSelect;
