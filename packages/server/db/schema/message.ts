import { nanoid } from "nanoid";
import { sql, relations } from "drizzle-orm";
import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./user";

export const message = sqliteTable(
  "message",
  {
    id: text("id").primaryKey().default(nanoid()),
    question: text("question").notNull(),
    content: text("content").notNull(),
    userId: text("user_id")
      .references(() => user.id, {
        onDelete: "cascade",
      })
      .notNull(),
    senderId: text("sender_id").references(() => user.id, {
      onDelete: "cascade",
    }),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (t) => {
    return {
      userIdIdx: index("user_id_idx").on(t.userId),
      senderIdIdx: index("sender_id_idx").on(t.senderId),
    };
  },
);

export const messagesRelations = relations(message, ({ one }) => ({
  user: one(user, {
    fields: [message.userId],
    references: [user.id],
  }),
  sender: one(user, {
    fields: [message.senderId],
    references: [user.id],
  }),
}));

export type InsertMessage = typeof message.$inferInsert;
export type SelectMessage = typeof message.$inferSelect;
