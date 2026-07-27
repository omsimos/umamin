import { userTable } from "@umamin/db/schema/user";
import { eq } from "drizzle-orm";
import * as z from "zod";
import { action } from "../../server-lib/action";
import { canonicalizeIp, extractClientIp } from "../../server-lib/ip";
import { allowIp, denyIp } from "../../server-lib/ip-denylist";
import { isModerator } from "../../server-lib/moderation";
import { invalidateUserSessions } from "../../server-lib/session";
import { ctxDb } from "./_shared";

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
