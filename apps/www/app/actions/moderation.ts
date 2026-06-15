"use server";

import { db } from "@umamin/db";
import { userTable } from "@umamin/db/schema/user";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { canonicalizeIp } from "@/lib/ip";
import { getClientIp } from "@/lib/ratelimit";
import { allowIp, denyIp } from "@/lib/server/ip-denylist";
import { isModerator } from "@/lib/server/moderation";
import { withAction } from "@/lib/server/with-action";
import { invalidateUserSessions } from "@/lib/session";

// Mirror the mod-delete actions: a non-moderator caller gets the same generic
// "not found" as a missing target, so the action never leaks who is a moderator
// or whether a username exists.
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

export const banUserAction = withAction(
  {
    schema: banSchema,
    auth: "user",
    rateLimit: { name: "write", key: ({ session }) => `ban:${session.userId}` },
  },
  async ({ username, reason }, { user }) => {
    if (!isModerator(user)) {
      return { error: NOT_FOUND };
    }

    const target = await db.query.userTable.findFirst({
      columns: { id: true, username: true },
      where: eq(userTable.username, username.toLowerCase()),
    });

    if (!target) {
      return { error: NOT_FOUND };
    }
    if (target.id === user.id) {
      return { error: "You can't ban yourself." };
    }
    if (isModerator(target)) {
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

    // Force-logout: delete all their sessions + bust the session cache so the
    // ban takes effect immediately (not after the ~60s session-cache TTL). The
    // validateSessionToken gate is the standing backstop after this.
    await invalidateUserSessions(target.id);

    return { success: true };
  },
);

export const unbanUserAction = withAction(
  {
    schema: usernameSchema,
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `unban:${session.userId}`,
    },
  },
  async ({ username }, { user }) => {
    if (!isModerator(user)) {
      return { error: NOT_FOUND };
    }

    const target = await db.query.userTable.findFirst({
      columns: { id: true },
      where: eq(userTable.username, username.toLowerCase()),
    });

    if (!target) {
      return { error: NOT_FOUND };
    }

    // The account can log in again immediately; nothing to revoke (it has no
    // live sessions while banned).
    await db
      .update(userTable)
      .set({ bannedAt: null, banReason: null, bannedBy: null })
      .where(eq(userTable.id, target.id));

    return { success: true };
  },
);

export const denyIpAction = withAction(
  {
    schema: ipSchema,
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `denyip:${session.userId}`,
    },
  },
  async ({ ip }, { user }) => {
    if (!isModerator(user)) {
      return { error: NOT_FOUND };
    }
    // Don't let a moderator block their own egress IP — the proxy would then
    // 403 every page (incl. this unblock UI) and their own server actions,
    // locking them out with no in-app recovery.
    if (canonicalizeIp(ip) === canonicalizeIp(await getClientIp())) {
      return { error: "You can't block your own IP address." };
    }
    await denyIp(ip);
    return { success: true };
  },
);

export const allowIpAction = withAction(
  {
    schema: ipSchema,
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `allowip:${session.userId}`,
    },
  },
  async ({ ip }, { user }) => {
    if (!isModerator(user)) {
      return { error: NOT_FOUND };
    }
    await allowIp(ip);
    return { success: true };
  },
);
