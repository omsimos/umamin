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

export type GroupMemberRole = "owner" | "member";

// "invite" = the creator invited this user (the user accepts). "request" = the
// user asked to join (the creator approves). Groups are private and
// invite/approval-gated — there is no open join.
export type GroupPendingKind = "invite" | "request";

export const groupTable = sqliteTable(
  "group",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    name: text("name").notNull(),
    description: text("description"),
    // Display form, uppercase. Immutable after creation — a rename would
    // ripple through every member's badge across the cached feeds.
    tag: text("tag").notNull(),
    // Confusable-folded form (0→O, 1→I, 5→S, …); uniqueness lives here so
    // lookalike tags collapse to one bucket and can't squat side by side.
    tagNorm: text("tag_norm").notNull(),
    icon: text("icon").notNull(),
    accent: text("accent"),
    creatorId: text("creator_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    // Denormalized; ±1 inside the member mutations' transactions so the cap
    // check and the page header never COUNT(*) the roster.
    memberCount: integer("member_count").notNull().default(1),
    // Denormalized newest group-chat message time — drives the hub's unread dot
    // (compared per-viewer against group_message_read) without a COUNT or scan.
    // Bumped in the same path as a message insert.
    lastMessageAt: integer("last_message_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$onUpdate(
      () => new Date(),
    ),
  },
  (t) => [
    uniqueIndex("group_tag_norm_uidx").on(t.tagNorm),
    // Owned-groups cap check + the user-delete FK cascade lookup.
    index("group_creator_idx").on(t.creatorId),
  ],
);

export const groupMemberTable = sqliteTable(
  "group_member",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    groupId: text("group_id")
      .notNull()
      .references(() => groupTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    role: text("role").$type<GroupMemberRole>().notNull().default("member"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("group_member_group_user_uidx").on(t.groupId, t.userId),
    index("group_member_group_created_idx").on(t.groupId, t.createdAt),
    index("group_member_user_created_idx").on(t.userId, t.createdAt),
  ],
);

// Pending invites and join requests. A group is private: members arrive only
// via a creator invite the user accepts, or a user request the creator
// approves. One pending edge per (group, user) — a crossing invite+request
// resolves to immediate membership in the action, never two rows.
export const groupPendingTable = sqliteTable(
  "group_pending",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    groupId: text("group_id")
      .notNull()
      .references(() => groupTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    kind: text("kind").$type<GroupPendingKind>().notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("group_pending_group_user_uidx").on(t.groupId, t.userId),
    // Creator's pending-requests list (bounded keyset pagination).
    index("group_pending_group_created_idx").on(t.groupId, t.createdAt),
    // A user's own pending invites/requests.
    index("group_pending_user_created_idx").on(t.userId, t.createdAt),
  ],
);

export const groupRelations = relations(groupTable, ({ one, many }) => ({
  creator: one(userTable, {
    fields: [groupTable.creatorId],
    references: [userTable.id],
  }),
  members: many(groupMemberTable),
  pending: many(groupPendingTable),
}));

export const groupPendingRelations = relations(
  groupPendingTable,
  ({ one }) => ({
    group: one(groupTable, {
      fields: [groupPendingTable.groupId],
      references: [groupTable.id],
    }),
    user: one(userTable, {
      fields: [groupPendingTable.userId],
      references: [userTable.id],
    }),
  }),
);

export const groupMemberRelations = relations(groupMemberTable, ({ one }) => ({
  group: one(groupTable, {
    fields: [groupMemberTable.groupId],
    references: [groupTable.id],
  }),
  user: one(userTable, {
    fields: [groupMemberTable.userId],
    references: [userTable.id],
  }),
}));

export type SelectGroup = typeof groupTable.$inferSelect;
export type SelectGroupMember = typeof groupMemberTable.$inferSelect;
export type SelectGroupPending = typeof groupPendingTable.$inferSelect;

export type InsertGroup = typeof groupTable.$inferInsert;
export type InsertGroupMember = typeof groupMemberTable.$inferInsert;
export type InsertGroupPending = typeof groupPendingTable.$inferInsert;
