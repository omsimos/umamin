import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";

export const orgTable = sqliteTable("org", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => nanoid()),
  // Lowercased + validated at the app/CLI layer. UNIQUE → also the lookup index.
  username: text("username").notNull().unique(),
  displayName: text("display_name"),
  // Always present — accounts are minted with a default password (no OAuth).
  passwordHash: text("password_hash").notNull(),
  // The prompt shown to anonymous senders on /to/<username>.
  question: text("question").notNull().default("Send us an anonymous message!"),
  imageUrl: text("image_url"),
  // Minted accounts start true → the app forces a change on first login.
  mustChangePassword: integer("must_change_password", { mode: "boolean" })
    .notNull()
    .default(true),
  // Lets an org pause its public submit page.
  acceptingMessages: integer("accepting_messages", { mode: "boolean" })
    .notNull()
    .default(true),
  // Null inherits the app's default anonymous-message character limit.
  messageCharLimit: integer("message_char_limit"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$onUpdate(
    () => new Date(),
  ),
});

export type SelectOrg = typeof orgTable.$inferSelect;
export type InsertOrg = typeof orgTable.$inferInsert;
