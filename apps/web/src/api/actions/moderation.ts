import { moderationDisputeTable } from "@umamin/db/schema/moderation-dispute";
import { noteTable } from "@umamin/db/schema/note";
import { postCommentTable, postTable } from "@umamin/db/schema/post";
import { userTable } from "@umamin/db/schema/user";
import { and, eq, isNull, sql } from "drizzle-orm";
import * as z from "zod";
import { action } from "../../server-lib/action";
import { contentLabel } from "../../server-lib/content-label";
import type { Db } from "../../server-lib/db";
import { severAllDms } from "../../server-lib/dm/lifecycle";
import { isModerationEnforced } from "../../server-lib/flags";
import { canonicalizeIp, extractClientIp } from "../../server-lib/ip";
import { allowIp, denyIp } from "../../server-lib/ip-denylist";
import { isModerator } from "../../server-lib/moderation";
import { captureRequestException } from "../../server-lib/posthog";
import { idSchema } from "../../server-lib/schema";
import { invalidateUserSessions } from "../../server-lib/session";
import { ctxDb, defer } from "./_shared";

// A non-moderator caller gets the same generic "not found" as a missing target,
// so the action never leaks who is a moderator or whether a username exists.
const NOT_FOUND = "User not found";

const usernameSchema = z.object({
  username: z.string().trim().min(1).max(20),
});

const banSchema = z.object({
  username: z.string().trim().min(1).max(20),
  reason: z.string().trim().max(500).optional(),
});

const ipSchema = z.object({
  ip: z.union([z.ipv4(), z.ipv6()]),
});

export const banUserHandler = action(
  {
    schema: banSchema,
    auth: "user",
    rateLimit: { name: "write", key: ({ session }) => `ban:${session.userId}` },
  },
  async ({ username, reason }, { user, c }) => {
    const db = ctxDb(c);
    const moderatorUsers = c.env.MODERATOR_USERS;
    if (!isModerator(user, moderatorUsers)) {
      return { error: NOT_FOUND };
    }

    const [target] = await db
      .select({ id: userTable.id, username: userTable.username })
      .from(userTable)
      .where(eq(userTable.username, username.toLowerCase()))
      .limit(1);

    if (!target) {
      return { error: NOT_FOUND };
    }
    if (target.id === user.id) {
      return { error: "You can't ban yourself." };
    }
    if (isModerator(target, moderatorUsers)) {
      return { error: "You can't ban another moderator." };
    }

    await db
      .update(userTable)
      .set({
        bannedAt: new Date(),
        banReason: reason ?? null,
        bannedBy: user.id,
      })
      .where(eq(userTable.id, target.id));

    // Force-logout: delete sessions + bust the session cache so the ban takes
    // effect immediately. validateSessionToken is the standing backstop after.
    await invalidateUserSessions(db, target.id);
    // Sessions don't cover sockets that are already open.
    defer(c)(
      severAllDms(db, c.env, target.id).catch((err) =>
        captureRequestException(c, err, { properties: { action: "ban-dm" } }),
      ),
    );

    return { success: true };
  },
);

export const unbanUserHandler = action(
  {
    schema: usernameSchema,
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `unban:${session.userId}`,
    },
  },
  async ({ username }, { user, c }) => {
    const db = ctxDb(c);
    if (!isModerator(user, c.env.MODERATOR_USERS)) {
      return { error: NOT_FOUND };
    }

    const [target] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.username, username.toLowerCase()))
      .limit(1);

    if (!target) {
      return { error: NOT_FOUND };
    }

    await db
      .update(userTable)
      .set({ bannedAt: null, banReason: null, bannedBy: null })
      .where(eq(userTable.id, target.id));

    return { success: true };
  },
);

export const denyIpHandler = action(
  {
    schema: ipSchema,
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `denyip:${session.userId}`,
    },
  },
  async ({ ip }, { user, c }) => {
    if (!isModerator(user, c.env.MODERATOR_USERS)) {
      return { error: NOT_FOUND };
    }
    // Don't let a moderator block their own egress IP — the proxy would then
    // 403 every page (incl. this unblock UI), locking them out.
    const ownIp = extractClientIp((n) => c.req.header(n));
    if (canonicalizeIp(ip) === canonicalizeIp(ownIp)) {
      return { error: "You can't block your own IP address." };
    }
    await denyIp(c.env.KV, ip);
    return { success: true };
  },
);

export const allowIpHandler = action(
  {
    schema: ipSchema,
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `allowip:${session.userId}`,
    },
  },
  async ({ ip }, { user, c }) => {
    if (!isModerator(user, c.env.MODERATOR_USERS)) {
      return { error: NOT_FOUND };
    }
    await allowIp(c.env.KV, ip);
    return { success: true };
  },
);

const clearFlagSchema = z.object({
  kind: z.enum(["post", "comment", "note"]),
  id: idSchema,
});

const REVIEW_TABLES = {
  post: postTable,
  comment: postCommentTable,
  note: noteTable,
} as const;

// A moderator marks a classifier flag a false positive: the row keeps its
// scores (for tuning) but loses its label and leaves the review queue.
export const clearContentFlagHandler = action(
  {
    schema: clearFlagSchema,
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `clearflag:${session.userId}`,
    },
  },
  async ({ kind, id }, { user, c }) => {
    if (!isModerator(user, c.env.MODERATOR_USERS)) {
      return { error: "Not found" };
    }
    const table = REVIEW_TABLES[kind];
    await ctxDb(c)
      .update(table)
      // Pinned: $onUpdate would restamp updated_at, which is a note's position
      // in /notes; a review decision or a viewer's dispute must not bump it.
      .set({ modClearedAt: new Date(), updatedAt: sql`${table.updatedAt}` })
      .where(eq(table.id, id));
    return { success: true };
  },
);

const keepFlagSchema = clearFlagSchema;

// A moderator looked and agrees with the label (or, for an uncovered flag,
// sees nothing to act on): the row keeps its label and leaves the queue.
export const keepContentFlagHandler = action(
  {
    schema: keepFlagSchema,
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `keepflag:${session.userId}`,
    },
  },
  async ({ kind, id }, { user, c }) => {
    if (!isModerator(user, c.env.MODERATOR_USERS)) {
      return { error: "Not found" };
    }
    const table = REVIEW_TABLES[kind];
    await ctxDb(c)
      .update(table)
      .set({ modReviewedAt: new Date(), updatedAt: sql`${table.updatedAt}` })
      .where(eq(table.id, id));
    return { success: true };
  },
);

const OWNER_COLUMNS = {
  post: postTable.authorId,
  comment: postCommentTable.authorId,
  note: noteTable.userId,
} as const;

async function loadLabelled(
  db: Db,
  kind: keyof typeof REVIEW_TABLES,
  id: string,
  enforce: boolean,
) {
  const table = REVIEW_TABLES[kind];
  const [row] = await db
    .select({
      ownerId: OWNER_COLUMNS[kind],
      modSevere: table.modSevere,
      modDrama: table.modDrama,
      modClearedAt: table.modClearedAt,
      modReviewedAt: table.modReviewedAt,
      modAppealedAt: table.modAppealedAt,
    })
    .from(table)
    .where(eq(table.id, id))
    .limit(1);
  return row && contentLabel(row, enforce) ? row : null;
}

const NOT_LABELLED = "This isn't covered or folded anymore.";
const ALREADY_REVIEWED = "A moderator already reviewed this.";

// The author asks a moderator to look at Uma's label on their own content.
export const appealContentLabelHandler = action(
  {
    schema: clearFlagSchema,
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `appeal:${session.userId}`,
    },
  },
  async ({ kind, id }, { session, c }) => {
    const db = ctxDb(c);
    const row = await loadLabelled(
      db,
      kind,
      id,
      await isModerationEnforced(c.env),
    );
    if (!row || row.ownerId !== session.userId) return { error: NOT_LABELLED };
    if (row.modReviewedAt) return { error: ALREADY_REVIEWED };

    const table = REVIEW_TABLES[kind];
    await db
      .update(table)
      .set({
        modAppealedAt: sql`coalesce(${table.modAppealedAt}, unixepoch())`,
        modFlaggedAt: sql`coalesce(${table.modFlaggedAt}, unixepoch())`,
        updatedAt: sql`${table.updatedAt}`,
      })
      .where(eq(table.id, id));
    return { success: true };
  },
);

// A viewer says Uma's label is wrong. Counted once per viewer; it puts the
// item in the review queue unless a moderator already decided on it.
export const disputeContentLabelHandler = action(
  {
    schema: clearFlagSchema,
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `dispute:${session.userId}`,
    },
  },
  async ({ kind, id }, { session, c }) => {
    const db = ctxDb(c);
    const row = await loadLabelled(
      db,
      kind,
      id,
      await isModerationEnforced(c.env),
    );
    if (!row || row.ownerId === session.userId) return { error: NOT_LABELLED };
    if (row.modReviewedAt) return { error: ALREADY_REVIEWED };

    const table = REVIEW_TABLES[kind];
    await db.batch([
      db
        .insert(moderationDisputeTable)
        .values({ kind, targetId: id, userId: session.userId })
        .onConflictDoNothing(),
      db
        .update(table)
        .set({
          modFlaggedAt: sql`coalesce(${table.modFlaggedAt}, unixepoch())`,
          updatedAt: sql`${table.updatedAt}`,
        })
        .where(and(eq(table.id, id), isNull(table.modReviewedAt))),
    ]);
    return { success: true };
  },
);
