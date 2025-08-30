import { nanoid } from "nanoid";
import { sql, relations } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { userTable } from "./user";

export const messageTable = sqliteTable(
  "messageTable",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    question: text("question").notNull(),
    content: text("content").notNull(),
    reply: text("reply"),
    receiverId: text("receiver_id").notNull(),
    senderId: text("sender_id"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$onUpdate(
      () => sql`(unixepoch())`,
    ),
  },
  (t) => [
    index("receiver_id_created_at_id_idx").on(t.receiverId, t.createdAt, t.id),
    index("sender_id_created_at_id_idx").on(t.senderId, t.createdAt, t.id),
  ],
);

export const messageRelations = relations(messageTable, ({ one }) => ({
  receiver: one(userTable, {
    fields: [messageTable.receiverId],
    references: [userTable.id],
    relationName: "receiver",
  }),
  sender: one(userTable, {
    fields: [messageTable.senderId],
    references: [userTable.id],
    relationName: "sender",
  }),
}));

export type InsertMessage = typeof messageTable.$inferInsert;
export type SelectMessage = typeof messageTable.$inferSelect;
