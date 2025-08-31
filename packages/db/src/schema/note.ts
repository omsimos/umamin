import { nanoid } from "nanoid";
import { sql, relations } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$onUpdate(
      () => new Date(),
    ),
  },
  (t) => [index("updated_at_id_idx").on(t.updatedAt, t.id)],
);

export const noteRelations = relations(noteTable, ({ one }) => ({
  user: one(userTable, {
    fields: [noteTable.userId],
    references: [userTable.id],
  }),
}));

export type InsertNote = typeof noteTable.$inferInsert;
export type SelectNote = typeof noteTable.$inferSelect;
