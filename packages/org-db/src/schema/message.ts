import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";
import { orgTable } from "./org";

export const orgMessageTable = sqliteTable(
  "org_message",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    orgId: text("org_id")
      .notNull()
      .references(() => orgTable.id, { onDelete: "cascade" }),
    // Denormalized copy of org.question at send time.
    question: text("question").notNull(),
    // AES-256-GCM encrypted at rest (see @umamin/encryption).
    content: text("content").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  // Keyset pagination of an org's inbox: WHERE org_id = ? ORDER BY created_at, id.
  (t) => [
    index("org_message_org_created_id_idx").on(t.orgId, t.createdAt, t.id),
  ],
);

export type SelectOrgMessage = typeof orgMessageTable.$inferSelect;
export type InsertOrgMessage = typeof orgMessageTable.$inferInsert;
