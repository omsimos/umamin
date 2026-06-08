"use server";

import { db } from "@umamin/db";
import {
  groupMemberTable,
  groupPendingTable,
  groupTable,
} from "@umamin/db/schema/group";
import { userTable } from "@umamin/db/schema/user";
import { and, eq, lt, sql } from "drizzle-orm";
import { revalidateTag, updateTag } from "next/cache";
import * as z from "zod";
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
} from "@/lib/group";
import { idSchema } from "@/lib/schema";
import {
  isUniqueConstraintViolation,
  UNAUTHORIZED_ERROR,
} from "@/lib/server/errors";
import { isReservedGroupTag } from "@/lib/server/group-reserved";
import { notify } from "@/lib/server/notifications";
import { withAction } from "@/lib/server/with-action";
import { formatUsername, hasUmaminPlus } from "@/lib/utils";

// A badge equip/unequip changes the author payload baked into the shared
// public feed caches. Background SWR only — the member's own surfaces get
// read-your-writes via the user/user-groups updateTags at each call site.
function revalidateBadgeFeeds() {
  revalidateTag("posts", "max");
  revalidateTag("notes", "max");
}

// Both caps throw inside the transaction so the member insert + count bump
// roll back together — surfaced here as their own messages. Self-acting paths
// (request / accept-invite) keep the first-person cap message.
function mapMembershipError(err: unknown) {
  if (err instanceof Error && err.message === GROUP_JOINED_CAP_ERROR) {
    return { error: GROUP_JOINED_CAP_ERROR };
  }
  if (err instanceof Error && err.message === GROUP_FULL_ERROR) {
    return { error: GROUP_FULL_ERROR };
  }
  return undefined;
}

// Owner-acting paths (invite auto-accept / approve request): the OTHER person
// is the one who hit the joined cap, so re-word it for the actor.
function mapMembershipErrorForTarget(err: unknown) {
  if (err instanceof Error && err.message === GROUP_JOINED_CAP_ERROR) {
    return { error: GROUP_TARGET_CAPPED_ERROR };
  }
  if (err instanceof Error && err.message === GROUP_FULL_ERROR) {
    return { error: GROUP_FULL_ERROR };
  }
  return undefined;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Promotes a user to an active member inside an open transaction with the
 * atomic cap guards. Returns "already" when the row already exists (race);
 * throws GROUP_JOINED_CAP_ERROR / GROUP_FULL_ERROR to roll the whole tx back.
 * Auto-equips only when `autoEquipFor` is the joining user acting on their own
 * behalf and they wear no badge yet.
 */
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

  // Bump only while under the cap; writers serialize on SQLite, so a racing
  // joiner that would breach the cap updates 0 rows and rolls its insert back.
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

export const createGroupAction = withAction(
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
  async ({ name, description, tag, icon, accent }, { session, user }) => {
    // Re-checked server-side: the dialog gate is UX-only.
    if (!hasUmaminPlus(user.createdAt)) {
      return { error: GROUP_PLUS_REQUIRED_ERROR };
    }

    // Reserved tags read as "taken" — don't reveal the blocklist to probers.
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

      // Creating consumes a membership slot too. Bounded read: the cap keeps
      // this at most JOINED_GROUPS_CAP rows.
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

      // Auto-equip: you made the tag, you're wearing it. One tap to switch.
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
    updateTag(`user:${session.userId}`);
    updateTag(`user:${user.username}`);
    updateTag(`user-groups:${session.userId}`);
    // Bust any cached 404 for this tag so a page/probe before creation doesn't
    // keep serving "not found" for up to the revalidate window.
    updateTag(`group-tag:${group.tagNorm}`);
    revalidateBadgeFeeds();

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

export const inviteToGroupAction = withAction(
  {
    schema: inviteToGroupSchema,
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `group:${session.userId}`,
    },
    // Crossing a pending request auto-adds the invitee, so the cap that throws
    // is the INVITEE's — re-word it for the owner.
    onError: mapMembershipErrorForTarget,
  },
  async ({ groupId, username }, { session }) => {
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

      // They already asked — inviting them IS the approval.
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

    updateTag(`user-groups:${target.id}`);

    if (outcome.kind === "accepted") {
      updateTag(`group:${groupId}`);
      updateTag(`group-members:${groupId}`);
      updateTag(`group-requests:${groupId}`);
      await notify({
        recipientId: target.id,
        type: "group_accept",
        targetId: groupId,
        actorId: session.userId,
        preview: group.name,
      });
      return { success: true, accepted: true };
    }

    await notify({
      recipientId: target.id,
      type: "group_invite",
      targetId: groupId,
      actorId: session.userId,
      preview: group.name,
    });
    return { success: true };
  },
);

export const requestToJoinGroupAction = withAction(
  {
    schema: z.object({ groupId: idSchema }),
    auth: "user",
    rateLimit: {
      name: "group-join",
      key: ({ session }) => `request:${session.userId}`,
    },
    onError: mapMembershipError,
  },
  async ({ groupId }, { session, user }) => {
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

    // Reject at request time when already at the joined cap — otherwise the
    // request sits un-approvable and the owner hits the cap error on approval.
    // (Approval still re-enforces the cap atomically inside addActiveMember.)
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

      // Already invited — requesting IS accepting the invite.
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

    updateTag(`user-groups:${session.userId}`);

    if (outcome.kind === "joined") {
      updateTag(`group:${groupId}`);
      updateTag(`group-members:${groupId}`);
      if (outcome.equipped) {
        updateTag(`user:${session.userId}`);
        updateTag(`user:${user.username}`);
        revalidateBadgeFeeds();
      }
      await notify({
        recipientId: group.creatorId,
        type: "group_join",
        targetId: groupId,
        actorId: session.userId,
        preview: group.name,
      });
      return { success: true, joined: true, equipped: outcome.equipped };
    }

    updateTag(`group-requests:${groupId}`);
    await notify({
      recipientId: group.creatorId,
      type: "group_request",
      targetId: groupId,
      actorId: session.userId,
      preview: group.name,
    });
    return { success: true, requested: true };
  },
);

export const respondToInviteAction = withAction(
  {
    schema: z.object({ groupId: idSchema, accept: z.boolean() }),
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `group:${session.userId}`,
    },
    onError: mapMembershipError,
  },
  async ({ groupId, accept }, { session, user }) => {
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

    updateTag(`user-groups:${session.userId}`);

    if (result.kind === "accepted") {
      updateTag(`group:${groupId}`);
      updateTag(`group-members:${groupId}`);
      if (result.equipped) {
        updateTag(`user:${session.userId}`);
        updateTag(`user:${user.username}`);
        revalidateBadgeFeeds();
      }
      if (result.creatorId) {
        await notify({
          recipientId: result.creatorId,
          type: "group_join",
          targetId: groupId,
          actorId: session.userId,
          preview: result.name,
        });
      }
    }

    return { success: true, accepted: result.kind === "accepted" };
  },
);

export const respondToJoinRequestAction = withAction(
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
    // Approving adds the REQUESTER, so a cap throw is theirs — re-word it.
    onError: mapMembershipErrorForTarget,
  },
  async ({ groupId, userId, accept }, { session }) => {
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

    updateTag(`group-requests:${groupId}`);
    updateTag(`user-groups:${userId}`);

    if (result.kind === "approved") {
      updateTag(`group:${groupId}`);
      updateTag(`group-members:${groupId}`);
      await notify({
        recipientId: userId,
        type: "group_accept",
        targetId: groupId,
        actorId: session.userId,
        preview: group.name,
      });
    }

    return { success: true, approved: result.kind === "approved" };
  },
);

export const cancelJoinRequestAction = withAction(
  {
    schema: z.object({ groupId: idSchema }),
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `group:${session.userId}`,
    },
  },
  async ({ groupId }, { session }) => {
    await db
      .delete(groupPendingTable)
      .where(
        and(
          eq(groupPendingTable.groupId, groupId),
          eq(groupPendingTable.userId, session.userId),
          eq(groupPendingTable.kind, "request"),
        ),
      );

    updateTag(`user-groups:${session.userId}`);
    updateTag(`group-requests:${groupId}`);

    return { success: true };
  },
);

export const equipGroupBadgeAction = withAction(
  {
    schema: z.object({ groupId: idSchema.nullable() }),
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `equip:${session.userId}`,
    },
  },
  async ({ groupId }, { session, user }) => {
    if (groupId) {
      // Membership is the authority — without this check anyone could wear
      // any group's badge.
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

    updateTag(`user:${session.userId}`);
    updateTag(`user:${user.username}`);
    updateTag(`user-groups:${session.userId}`);
    revalidateBadgeFeeds();

    return { success: true, equippedGroupId: groupId };
  },
);

export const leaveGroupAction = withAction(
  {
    schema: z.object({ groupId: idSchema }),
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `group:${session.userId}`,
    },
  },
  async ({ groupId }, { session, user }) => {
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

    const cleared = await db.transaction(async (tx) => {
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
        return false;
      }

      await tx
        .update(groupTable)
        .set({
          memberCount: sql`CASE WHEN ${groupTable.memberCount} > 0 THEN ${groupTable.memberCount} - 1 ELSE 0 END`,
        })
        .where(eq(groupTable.id, groupId));

      // The badge must drop atomically with the membership — a stale equip
      // would broadcast an affiliation that no longer exists.
      const clearedRows = await tx
        .update(userTable)
        .set({ equippedGroupId: null })
        .where(
          and(
            eq(userTable.id, session.userId),
            eq(userTable.equippedGroupId, groupId),
          ),
        )
        .returning({ id: userTable.id });

      return clearedRows.length > 0;
    });

    updateTag(`group:${groupId}`);
    updateTag(`group-members:${groupId}`);
    updateTag(`user-groups:${session.userId}`);
    if (cleared) {
      updateTag(`user:${session.userId}`);
      updateTag(`user:${user.username}`);
      revalidateBadgeFeeds();
    }

    return { success: true };
  },
);

export const kickGroupMemberAction = withAction(
  {
    schema: z.object({ groupId: idSchema, userId: idSchema }),
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `group:${session.userId}`,
    },
  },
  async ({ groupId, userId }, { session }) => {
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

      const cleared = await tx
        .update(userTable)
        .set({ equippedGroupId: null })
        .where(
          and(eq(userTable.id, userId), eq(userTable.equippedGroupId, groupId)),
        )
        .returning({ username: userTable.username });

      return { removed: true as const, clearedUsername: cleared[0]?.username };
    });

    if (!result.removed) {
      return { error: "That user isn't a member of this group." };
    }

    updateTag(`group:${groupId}`);
    updateTag(`group-members:${groupId}`);
    updateTag(`user-groups:${userId}`);
    if (result.clearedUsername) {
      updateTag(`user:${userId}`);
      updateTag(`user:${result.clearedUsername}`);
      revalidateBadgeFeeds();
    }

    return { success: true };
  },
);

export const updateGroupAction = withAction(
  {
    schema: updateGroupSchema,
    auth: "user",
    rateLimit: {
      name: "group-edit",
      // User-keyed, but OWNED_GROUPS_CAP is 1 so this is effectively the
      // per-group cooldown protecting the shared feed caches.
      key: ({ session }) => `group-edit:${session.userId}`,
    },
  },
  async ({ groupId, name, description, icon, accent }, { session }) => {
    const [group] = await db
      .select({ creatorId: groupTable.creatorId })
      .from(groupTable)
      .where(eq(groupTable.id, groupId))
      .limit(1);

    if (!group || group.creatorId !== session.userId) {
      return { error: UNAUTHORIZED_ERROR };
    }

    await db
      .update(groupTable)
      .set({ name, description, icon, accent })
      .where(eq(groupTable.id, groupId));

    updateTag(`group:${groupId}`);
    // Icon/accent ride every member's badge in the shared feeds.
    revalidateBadgeFeeds();

    return { success: true };
  },
);

export const deleteGroupAction = withAction(
  {
    schema: z.object({ groupId: idSchema }),
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `group:${session.userId}`,
    },
  },
  async ({ groupId }, { session, user }) => {
    const [group] = await db
      .select({ creatorId: groupTable.creatorId })
      .from(groupTable)
      .where(eq(groupTable.id, groupId))
      .limit(1);

    if (!group || group.creatorId !== session.userId) {
      return { error: UNAUTHORIZED_ERROR };
    }

    await db.transaction(async (tx) => {
      // The only O(members) write in the feature: one bounded statement, not
      // per-row loops. equippedGroupId is a soft ref, so without this a
      // dangling id would still render no badge — this keeps equip-picker
      // state truthful.
      await tx
        .update(userTable)
        .set({ equippedGroupId: null })
        .where(eq(userTable.equippedGroupId, groupId));

      // FK cascade clears group_member + group_pending rows.
      await tx.delete(groupTable).where(eq(groupTable.id, groupId));
    });

    updateTag(`group:${groupId}`);
    updateTag(`group-members:${groupId}`);
    updateTag(`group-requests:${groupId}`);
    updateTag(`user-groups:${session.userId}`);
    updateTag(`user:${session.userId}`);
    updateTag(`user:${user.username}`);
    revalidateBadgeFeeds();

    return { success: true };
  },
);
