import {
  groupMemberTable,
  groupPendingTable,
  groupTable,
} from "@umamin/db/schema/group";
import { userTable } from "@umamin/db/schema/user";
import { and, eq, lt, sql } from "drizzle-orm";
import * as z from "zod";
import { action } from "../../server-lib/action";
import { formatUsername, hasUmaminPlus } from "../../server-lib/content";
import type { Db } from "../../server-lib/db";
import {
  isUniqueConstraintViolation,
  UNAUTHORIZED_ERROR,
} from "../../server-lib/errors";
import {
  createGroupSchema,
  formatGroupTag,
  GROUP_ALREADY_MEMBER_ERROR,
  GROUP_CANNOT_INVITE_SELF_ERROR,
  GROUP_FULL_ERROR,
  GROUP_INVITE_PENDING_ERROR,
  GROUP_JOINED_CAP_ERROR,
  GROUP_MEMBER_CAP,
  GROUP_NOT_PENDING_ERROR,
  GROUP_OWNED_CAP_ERROR,
  GROUP_OWNER_CANNOT_LEAVE_ERROR,
  GROUP_PLUS_REQUIRED_ERROR,
  GROUP_REQUEST_PENDING_ERROR,
  GROUP_TAG_TAKEN_ERROR,
  GROUP_TARGET_CAPPED_ERROR,
  GROUP_USER_NOT_FOUND_ERROR,
  inviteToGroupSchema,
  JOINED_GROUPS_CAP,
  normalizeGroupTag,
  updateGroupSchema,
} from "../../server-lib/group";
import {
  checkGroupEditWindow,
  GROUP_EDIT_RATE_LIMITED_ERROR,
} from "../../server-lib/group-edit";
import { isReservedGroupTag } from "../../server-lib/group-reserved";
import { notify } from "../../server-lib/notifications";
import { idSchema } from "../../server-lib/schema";
import { ctxDb, defer } from "./_shared";

// Cache-tag fan-out is gone in the Worker port (see api/actions/post.ts note);
// badge-feed revalidation that used revalidateTag("posts"/"notes") is now the
// short-TTL public read cache's job, so those calls simply drop out here.

function mapMembershipError(err: unknown) {
  if (err instanceof Error && err.message === GROUP_JOINED_CAP_ERROR) {
    return { error: GROUP_JOINED_CAP_ERROR };
  }
  if (err instanceof Error && err.message === GROUP_FULL_ERROR) {
    return { error: GROUP_FULL_ERROR };
  }
  return undefined;
}

function mapMembershipErrorForTarget(err: unknown) {
  if (err instanceof Error && err.message === GROUP_JOINED_CAP_ERROR) {
    return { error: GROUP_TARGET_CAPPED_ERROR };
  }
  if (err instanceof Error && err.message === GROUP_FULL_ERROR) {
    return { error: GROUP_FULL_ERROR };
  }
  return undefined;
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

async function addActiveMember(
  tx: Tx,
  {
    groupId,
    userId,
    autoEquipFor,
  }: { groupId: string; userId: string; autoEquipFor?: string },
): Promise<{ status: "added"; equipped: boolean } | { status: "already" }> {
  const joined = await tx
    .select({ id: groupMemberTable.id })
    .from(groupMemberTable)
    .where(eq(groupMemberTable.userId, userId))
    .limit(JOINED_GROUPS_CAP);

  const inserted = await tx
    .insert(groupMemberTable)
    .values({ groupId, userId })
    .onConflictDoNothing()
    .returning({ id: groupMemberTable.id });

  if (inserted.length === 0) {
    return { status: "already" };
  }

  if (joined.length >= JOINED_GROUPS_CAP) {
    throw new Error(GROUP_JOINED_CAP_ERROR);
  }

  const bumped = await tx
    .update(groupTable)
    .set({ memberCount: sql`${groupTable.memberCount} + 1` })
    .where(
      and(
        eq(groupTable.id, groupId),
        lt(groupTable.memberCount, GROUP_MEMBER_CAP),
      ),
    )
    .returning({ id: groupTable.id });

  if (bumped.length === 0) {
    throw new Error(GROUP_FULL_ERROR);
  }

  let equipped = false;
  if (autoEquipFor) {
    const equippedRows = await tx
      .update(userTable)
      .set({ equippedGroupId: groupId })
      .where(
        and(
          eq(userTable.id, autoEquipFor),
          sql`${userTable.equippedGroupId} IS NULL`,
        ),
      )
      .returning({ id: userTable.id });
    equipped = equippedRows.length > 0;
  }

  return { status: "added", equipped };
}

export const createGroupHandler = action(
  {
    schema: createGroupSchema,
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `group:${session.userId}`,
    },
    onError: (err) =>
      isUniqueConstraintViolation(err, "group.tag_norm")
        ? { error: GROUP_TAG_TAKEN_ERROR }
        : undefined,
  },
  async ({ name, description, tag, icon, accent }, { session, user, c }) => {
    const db = ctxDb(c);
    if (!hasUmaminPlus(user.createdAt)) {
      return { error: GROUP_PLUS_REQUIRED_ERROR };
    }
    if (isReservedGroupTag(tag)) {
      return { error: GROUP_TAG_TAKEN_ERROR };
    }

    const result = await db.transaction(async (tx) => {
      const owned = await tx
        .select({ id: groupTable.id })
        .from(groupTable)
        .where(eq(groupTable.creatorId, session.userId))
        .limit(1);

      if (owned.length > 0) {
        return { error: GROUP_OWNED_CAP_ERROR };
      }

      const memberships = await tx
        .select({ id: groupMemberTable.id })
        .from(groupMemberTable)
        .where(eq(groupMemberTable.userId, session.userId))
        .limit(JOINED_GROUPS_CAP);

      if (memberships.length >= JOINED_GROUPS_CAP) {
        return { error: GROUP_JOINED_CAP_ERROR };
      }

      const [group] = await tx
        .insert(groupTable)
        .values({
          name,
          description,
          tag: formatGroupTag(tag),
          tagNorm: normalizeGroupTag(tag),
          icon,
          accent,
          creatorId: session.userId,
        })
        .returning();

      await tx.insert(groupMemberTable).values({
        groupId: group.id,
        userId: session.userId,
        role: "owner",
      });

      await tx
        .update(userTable)
        .set({ equippedGroupId: group.id })
        .where(eq(userTable.id, session.userId));

      return { group };
    });

    if ("error" in result) {
      return result;
    }

    const { group } = result;
    return {
      success: true,
      group: {
        id: group.id,
        tag: group.tag,
        name: group.name,
        icon: group.icon,
        accent: group.accent,
      },
    };
  },
);

export const inviteToGroupHandler = action(
  {
    schema: inviteToGroupSchema,
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `group:${session.userId}`,
    },
    onError: mapMembershipErrorForTarget,
  },
  async ({ groupId, username }, { session, c }) => {
    const db = ctxDb(c);
    const [group] = await db
      .select({
        id: groupTable.id,
        name: groupTable.name,
        creatorId: groupTable.creatorId,
      })
      .from(groupTable)
      .where(eq(groupTable.id, groupId))
      .limit(1);

    if (!group || group.creatorId !== session.userId) {
      return { error: UNAUTHORIZED_ERROR };
    }

    const [target] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.username, formatUsername(username)))
      .limit(1);

    if (!target) {
      return { error: GROUP_USER_NOT_FOUND_ERROR };
    }
    if (target.id === session.userId) {
      return { error: GROUP_CANNOT_INVITE_SELF_ERROR };
    }

    const [member] = await db
      .select({ id: groupMemberTable.id })
      .from(groupMemberTable)
      .where(
        and(
          eq(groupMemberTable.groupId, groupId),
          eq(groupMemberTable.userId, target.id),
        ),
      )
      .limit(1);

    if (member) {
      return { error: GROUP_ALREADY_MEMBER_ERROR };
    }

    const outcome = await db.transaction(async (tx) => {
      const [pending] = await tx
        .select({ kind: groupPendingTable.kind })
        .from(groupPendingTable)
        .where(
          and(
            eq(groupPendingTable.groupId, groupId),
            eq(groupPendingTable.userId, target.id),
          ),
        )
        .limit(1);

      if (pending?.kind === "invite") {
        return { kind: "alreadyInvited" as const };
      }

      if (pending?.kind === "request") {
        await tx
          .delete(groupPendingTable)
          .where(
            and(
              eq(groupPendingTable.groupId, groupId),
              eq(groupPendingTable.userId, target.id),
            ),
          );
        await addActiveMember(tx, { groupId, userId: target.id });
        return { kind: "accepted" as const };
      }

      await tx
        .insert(groupPendingTable)
        .values({ groupId, userId: target.id, kind: "invite" })
        .onConflictDoNothing();
      return { kind: "invited" as const };
    });

    if (outcome.kind === "alreadyInvited") {
      return { error: GROUP_INVITE_PENDING_ERROR };
    }

    const deps = { db, env: c.env, defer: defer(c) };

    if (outcome.kind === "accepted") {
      await notify(deps, {
        recipientId: target.id,
        type: "group_accept",
        targetId: groupId,
        actorId: session.userId,
        preview: group.name,
      });
      return { success: true, accepted: true };
    }

    await notify(deps, {
      recipientId: target.id,
      type: "group_invite",
      targetId: groupId,
      actorId: session.userId,
      preview: group.name,
    });
    return { success: true };
  },
);

export const requestToJoinGroupHandler = action(
  {
    schema: z.object({ groupId: idSchema }),
    auth: "user",
    rateLimit: {
      name: "group-join",
      key: ({ session }) => `request:${session.userId}`,
    },
    onError: mapMembershipError,
  },
  async ({ groupId }, { session, c }) => {
    const db = ctxDb(c);
    const [group] = await db
      .select({
        id: groupTable.id,
        name: groupTable.name,
        creatorId: groupTable.creatorId,
      })
      .from(groupTable)
      .where(eq(groupTable.id, groupId))
      .limit(1);

    if (!group) {
      return { error: "Group not found." };
    }

    const [member] = await db
      .select({ id: groupMemberTable.id })
      .from(groupMemberTable)
      .where(
        and(
          eq(groupMemberTable.groupId, groupId),
          eq(groupMemberTable.userId, session.userId),
        ),
      )
      .limit(1);

    if (member) {
      return { error: GROUP_ALREADY_MEMBER_ERROR };
    }

    const memberships = await db
      .select({ id: groupMemberTable.id })
      .from(groupMemberTable)
      .where(eq(groupMemberTable.userId, session.userId))
      .limit(JOINED_GROUPS_CAP);

    if (memberships.length >= JOINED_GROUPS_CAP) {
      return { error: GROUP_JOINED_CAP_ERROR };
    }

    const outcome = await db.transaction(async (tx) => {
      const [pending] = await tx
        .select({ kind: groupPendingTable.kind })
        .from(groupPendingTable)
        .where(
          and(
            eq(groupPendingTable.groupId, groupId),
            eq(groupPendingTable.userId, session.userId),
          ),
        )
        .limit(1);

      if (pending?.kind === "request") {
        return { kind: "alreadyRequested" as const };
      }

      if (pending?.kind === "invite") {
        await tx
          .delete(groupPendingTable)
          .where(
            and(
              eq(groupPendingTable.groupId, groupId),
              eq(groupPendingTable.userId, session.userId),
            ),
          );
        const added = await addActiveMember(tx, {
          groupId,
          userId: session.userId,
          autoEquipFor: session.userId,
        });
        return {
          kind: "joined" as const,
          equipped: added.status === "added" ? added.equipped : false,
        };
      }

      await tx
        .insert(groupPendingTable)
        .values({ groupId, userId: session.userId, kind: "request" })
        .onConflictDoNothing();
      return { kind: "requested" as const };
    });

    if (outcome.kind === "alreadyRequested") {
      return { error: GROUP_REQUEST_PENDING_ERROR };
    }

    const deps = { db, env: c.env, defer: defer(c) };

    if (outcome.kind === "joined") {
      await notify(deps, {
        recipientId: group.creatorId,
        type: "group_join",
        targetId: groupId,
        actorId: session.userId,
        preview: group.name,
      });
      return { success: true, joined: true, equipped: outcome.equipped };
    }

    await notify(deps, {
      recipientId: group.creatorId,
      type: "group_request",
      targetId: groupId,
      actorId: session.userId,
      preview: group.name,
    });
    return { success: true, requested: true };
  },
);

export const respondToInviteHandler = action(
  {
    schema: z.object({ groupId: idSchema, accept: z.boolean() }),
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `group:${session.userId}`,
    },
    onError: mapMembershipError,
  },
  async ({ groupId, accept }, { session, c }) => {
    const db = ctxDb(c);
    const result = await db.transaction(async (tx) => {
      const [pending] = await tx
        .select({ id: groupPendingTable.id })
        .from(groupPendingTable)
        .where(
          and(
            eq(groupPendingTable.groupId, groupId),
            eq(groupPendingTable.userId, session.userId),
            eq(groupPendingTable.kind, "invite"),
          ),
        )
        .limit(1);

      if (!pending) {
        return { kind: "none" as const };
      }

      await tx
        .delete(groupPendingTable)
        .where(eq(groupPendingTable.id, pending.id));

      if (!accept) {
        return { kind: "declined" as const };
      }

      const [group] = await tx
        .select({ creatorId: groupTable.creatorId, name: groupTable.name })
        .from(groupTable)
        .where(eq(groupTable.id, groupId))
        .limit(1);

      const added = await addActiveMember(tx, {
        groupId,
        userId: session.userId,
        autoEquipFor: session.userId,
      });

      return {
        kind: "accepted" as const,
        equipped: added.status === "added" ? added.equipped : false,
        creatorId: group?.creatorId ?? null,
        name: group?.name ?? null,
      };
    });

    if (result.kind === "none") {
      return { error: GROUP_NOT_PENDING_ERROR };
    }

    if (result.kind === "accepted" && result.creatorId) {
      await notify(
        { db, env: c.env, defer: defer(c) },
        {
          recipientId: result.creatorId,
          type: "group_join",
          targetId: groupId,
          actorId: session.userId,
          preview: result.name,
        },
      );
    }

    return { success: true, accepted: result.kind === "accepted" };
  },
);

export const respondToJoinRequestHandler = action(
  {
    schema: z.object({
      groupId: idSchema,
      userId: idSchema,
      accept: z.boolean(),
    }),
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `group:${session.userId}`,
    },
    onError: mapMembershipErrorForTarget,
  },
  async ({ groupId, userId, accept }, { session, c }) => {
    const db = ctxDb(c);
    const [group] = await db
      .select({ creatorId: groupTable.creatorId, name: groupTable.name })
      .from(groupTable)
      .where(eq(groupTable.id, groupId))
      .limit(1);

    if (!group || group.creatorId !== session.userId) {
      return { error: UNAUTHORIZED_ERROR };
    }

    const result = await db.transaction(async (tx) => {
      const [pending] = await tx
        .select({ id: groupPendingTable.id })
        .from(groupPendingTable)
        .where(
          and(
            eq(groupPendingTable.groupId, groupId),
            eq(groupPendingTable.userId, userId),
            eq(groupPendingTable.kind, "request"),
          ),
        )
        .limit(1);

      if (!pending) {
        return { kind: "none" as const };
      }

      await tx
        .delete(groupPendingTable)
        .where(eq(groupPendingTable.id, pending.id));

      if (!accept) {
        return { kind: "rejected" as const };
      }

      await addActiveMember(tx, { groupId, userId });
      return { kind: "approved" as const };
    });

    if (result.kind === "none") {
      return { error: GROUP_NOT_PENDING_ERROR };
    }

    if (result.kind === "approved") {
      await notify(
        { db, env: c.env, defer: defer(c) },
        {
          recipientId: userId,
          type: "group_accept",
          targetId: groupId,
          actorId: session.userId,
          preview: group.name,
        },
      );
    }

    return { success: true, approved: result.kind === "approved" };
  },
);

export const cancelJoinRequestHandler = action(
  {
    schema: z.object({ groupId: idSchema }),
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `group:${session.userId}`,
    },
  },
  async ({ groupId }, { session, c }) => {
    await ctxDb(c)
      .delete(groupPendingTable)
      .where(
        and(
          eq(groupPendingTable.groupId, groupId),
          eq(groupPendingTable.userId, session.userId),
          eq(groupPendingTable.kind, "request"),
        ),
      );

    return { success: true };
  },
);

export const equipGroupBadgeHandler = action(
  {
    schema: z.object({ groupId: idSchema.nullable() }),
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `equip:${session.userId}`,
    },
  },
  async ({ groupId }, { session, c }) => {
    const db = ctxDb(c);
    if (groupId) {
      const member = await db
        .select({ id: groupMemberTable.id })
        .from(groupMemberTable)
        .where(
          and(
            eq(groupMemberTable.groupId, groupId),
            eq(groupMemberTable.userId, session.userId),
          ),
        )
        .limit(1);

      if (member.length === 0) {
        return { error: UNAUTHORIZED_ERROR };
      }
    }

    await db
      .update(userTable)
      .set({ equippedGroupId: groupId })
      .where(eq(userTable.id, session.userId));

    return { success: true, equippedGroupId: groupId };
  },
);

export const leaveGroupHandler = action(
  {
    schema: z.object({ groupId: idSchema }),
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `group:${session.userId}`,
    },
  },
  async ({ groupId }, { session, c }) => {
    const db = ctxDb(c);
    const [membership] = await db
      .select({ role: groupMemberTable.role })
      .from(groupMemberTable)
      .where(
        and(
          eq(groupMemberTable.groupId, groupId),
          eq(groupMemberTable.userId, session.userId),
        ),
      )
      .limit(1);

    if (!membership) {
      return { error: "You're not a member of this group." };
    }

    if (membership.role === "owner") {
      return { error: GROUP_OWNER_CANNOT_LEAVE_ERROR };
    }

    await db.transaction(async (tx) => {
      const removed = await tx
        .delete(groupMemberTable)
        .where(
          and(
            eq(groupMemberTable.groupId, groupId),
            eq(groupMemberTable.userId, session.userId),
          ),
        )
        .returning({ id: groupMemberTable.id });

      if (removed.length === 0) {
        return;
      }

      await tx
        .update(groupTable)
        .set({
          memberCount: sql`CASE WHEN ${groupTable.memberCount} > 0 THEN ${groupTable.memberCount} - 1 ELSE 0 END`,
        })
        .where(eq(groupTable.id, groupId));

      await tx
        .update(userTable)
        .set({ equippedGroupId: null })
        .where(
          and(
            eq(userTable.id, session.userId),
            eq(userTable.equippedGroupId, groupId),
          ),
        );
    });

    return { success: true };
  },
);

export const kickGroupMemberHandler = action(
  {
    schema: z.object({ groupId: idSchema, userId: idSchema }),
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `group:${session.userId}`,
    },
  },
  async ({ groupId, userId }, { session, c }) => {
    const db = ctxDb(c);
    const [group] = await db
      .select({ creatorId: groupTable.creatorId })
      .from(groupTable)
      .where(eq(groupTable.id, groupId))
      .limit(1);

    if (!group || group.creatorId !== session.userId) {
      return { error: UNAUTHORIZED_ERROR };
    }

    if (userId === session.userId) {
      return { error: "You can't kick yourself." };
    }

    const result = await db.transaction(async (tx) => {
      const removed = await tx
        .delete(groupMemberTable)
        .where(
          and(
            eq(groupMemberTable.groupId, groupId),
            eq(groupMemberTable.userId, userId),
          ),
        )
        .returning({ id: groupMemberTable.id });

      if (removed.length === 0) {
        return { removed: false as const };
      }

      await tx
        .update(groupTable)
        .set({
          memberCount: sql`CASE WHEN ${groupTable.memberCount} > 0 THEN ${groupTable.memberCount} - 1 ELSE 0 END`,
        })
        .where(eq(groupTable.id, groupId));

      await tx
        .update(userTable)
        .set({ equippedGroupId: null })
        .where(
          and(eq(userTable.id, userId), eq(userTable.equippedGroupId, groupId)),
        );

      return { removed: true as const };
    });

    if (!result.removed) {
      return { error: "That user isn't a member of this group." };
    }

    return { success: true };
  },
);

export const updateGroupHandler = action(
  {
    schema: updateGroupSchema,
    auth: "user",
    // The old `group-edit` 2/day limiter isn't expressible via the Workers RL
    // binding — it moves to a Turso edit-window check (currently a stubbed
    // allow; see server-lib/group-edit.ts TODO). A cheap per-user write limiter
    // still guards burst spam.
    rateLimit: {
      name: "write",
      key: ({ session }) => `group-edit:${session.userId}`,
    },
  },
  async ({ groupId, name, description, icon, accent }, { session, c }) => {
    const db = ctxDb(c);
    const [group] = await db
      .select({ creatorId: groupTable.creatorId })
      .from(groupTable)
      .where(eq(groupTable.id, groupId))
      .limit(1);

    if (!group || group.creatorId !== session.userId) {
      return { error: UNAUTHORIZED_ERROR };
    }

    const window = await checkGroupEditWindow(db, groupId);
    if (!window.allowed) {
      return { error: GROUP_EDIT_RATE_LIMITED_ERROR };
    }

    await db
      .update(groupTable)
      .set({ name, description, icon, accent })
      .where(eq(groupTable.id, groupId));

    return { success: true };
  },
);

export const deleteGroupHandler = action(
  {
    schema: z.object({ groupId: idSchema }),
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `group:${session.userId}`,
    },
  },
  async ({ groupId }, { session, c }) => {
    const db = ctxDb(c);
    const [group] = await db
      .select({ creatorId: groupTable.creatorId })
      .from(groupTable)
      .where(eq(groupTable.id, groupId))
      .limit(1);

    if (!group || group.creatorId !== session.userId) {
      return { error: UNAUTHORIZED_ERROR };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(userTable)
        .set({ equippedGroupId: null })
        .where(eq(userTable.equippedGroupId, groupId));

      await tx.delete(groupTable).where(eq(groupTable.id, groupId));
    });

    return { success: true };
  },
);
