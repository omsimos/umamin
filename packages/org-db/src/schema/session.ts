import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { orgTable } from "./org";

export const orgSessionTable = sqliteTable(
  "org_session",
  {
    id: text("id").notNull().primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgTable.id, { onDelete: "cascade" }),
    // Raw ms-epoch (Date.now()-based), not a timestamp column — mirrors www.
    expiresAt: integer("expires_at").notNull(),
  },
  // Backs DELETE ... WHERE org_id = ? (password-change revocation) and the
  // org-delete FK cascade lookup.
  (t) => [index("org_session_org_idx").on(t.orgId)],
);

export type SelectOrgSession = typeof orgSessionTable.$inferSelect;
export type InsertOrgSession = typeof orgSessionTable.$inferInsert;
