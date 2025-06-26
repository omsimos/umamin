import { nanoid } from "nanoid";
import { sql, relations } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./user";

export const note = sqliteTable(
  "note",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text("user_id").unique().notNull(),
    content: text("content").notNull(),
    isAnonymous: integer("is_anonymous", { mode: "boolean" }).notNull(),
    createdAt: integer("created_at", { mode: "number" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at").$onUpdate(() => sql`(unixepoch())`),
  },
  (t) => [index("updated_at_id_idx").on(t.updatedAt, t.id)],
);

export const noteRelations = relations(note, ({ one }) => ({
  user: one(user, {
    fields: [note.userId],
    references: [user.id],
  }),
}));

export type InsertNote = typeof note.$inferInsert;
export type SelectNote = typeof note.$inferSelect;
