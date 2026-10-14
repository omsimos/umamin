import { sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { userTable } from "./user";

// Kept out of moderation.ts: message.ts imports that file's column helpers,
// and user.ts imports message.ts, so a user import there is a cycle.
// One row per viewer who said a label was wrong, so a dispute counts once per
// person. target_id is a soft ref into post, post_comment or note by kind.
export const moderationDisputeTable = sqliteTable(
  "moderation_dispute",
  {
    kind: text("kind", { enum: ["post", "comment", "note"] }).notNull(),
    targetId: text("target_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [primaryKey({ columns: [t.kind, t.targetId, t.userId] })],
);
