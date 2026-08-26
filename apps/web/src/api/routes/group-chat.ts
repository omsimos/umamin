import {
  groupMessageReactionTable,
  groupMessageTable,
} from "@umamin/db/schema/group-message";
import { desc, eq } from "drizzle-orm";
import type { Context } from "hono";
import { Hono } from "hono";
import type { AppBindings } from "../../server-lib/context";
import {
  getGroupMessageReactions,
  getGroupMessageReactors,
  getGroupMessagesPage,
  getGroupMessagesSince,
  getGroupPageData,
  getGroupViewerRelationship,
} from "../../server-lib/data";
import type { AppEnv } from "../../server-lib/env";
import {
  formatErrorChain,
  INTERNAL_SERVER_ERROR,
  MEMBERS_ONLY_ERROR,
  NOT_FOUND_ERROR,
  UNAUTHORIZED_ERROR,
} from "../../server-lib/errors";
import {
  GROUP_CHAT_DISABLED_ERROR,
  GROUP_CHAT_ENABLED,
} from "../../server-lib/group";
import { checkRateLimit, RATE_LIMIT_ERROR } from "../../server-lib/ratelimit";
import { privateJson, withPublicRead } from "../../server-lib/read-route";
import { getSessionFrom, resolveDb } from "./_shared";

type Ctx = Context<AppBindings>;

// Members-only chat reads are rate-limited PER USER (not per IP like
// withPrivateRead) so a NAT'd room of members polling can't throttle one
// another — hence a hand-rolled handler mirroring apps/www.
async function guardMember(
  c: Ctx,
  rateKey: (userId: string) => string,
): Promise<
  { ok: true; groupId: string; userId: string } | { ok: false; res: Response }
> {
  if (!GROUP_CHAT_ENABLED) {
    return {
      ok: false,
      res: privateJson({ error: GROUP_CHAT_DISABLED_ERROR }, 403),
    };
  }

  const db = resolveDb(c.env);
  const { session } = await getSessionFrom(c);
  if (!session) {
    return {
      ok: false,
      res: privateJson({ error: UNAUTHORIZED_ERROR }, 401),
    };
  }

  if (!(await checkRateLimit(c.env, "group-read", rateKey(session.userId)))) {
    return {
      ok: false,
      res: privateJson({ error: RATE_LIMIT_ERROR }, 429),
    };
  }

  const group = await getGroupPageData(db, c.req.param("tag") ?? "");
  if (!group) {
    return {
      ok: false,
      res: privateJson({ error: NOT_FOUND_ERROR }, 404),
    };
  }

  const relationship = await getGroupViewerRelationship(
    db,
    session.userId,
    group.id,
  );
  if (relationship !== "owner" && relationship !== "member") {
    return {
      ok: false,
      res: privateJson({ error: MEMBERS_ONLY_ERROR }, 403),
    };
  }

  return { ok: true, groupId: group.id, userId: session.userId };
}

// Turso-backed head poll (replaces the deleted Redis head keys). `tail` = the
// newest message createdAt (ms) — seek on (groupId, createdAt, id), never a
// SCAN. `rxn` = the newest reaction createdAt (ms) across the group's messages;
// a reaction on an OLD message doesn't advance the tail, so the poll loop needs
// this separate marker. Both null when the room is empty. {tail, rxn} shape is
// byte-compatible with apps/www's Redis-backed head route.
async function readHead(
  env: AppEnv,
  groupId: string,
): Promise<{ tail: number | null; rxn: number | null }> {
  const db = resolveDb(env);
  const [tailRow, rxnRow] = await Promise.all([
    db
      .select({ createdAt: groupMessageTable.createdAt })
      .from(groupMessageTable)
      .where(eq(groupMessageTable.groupId, groupId))
      .orderBy(desc(groupMessageTable.createdAt))
      .limit(1),
    db
      .select({ createdAt: groupMessageReactionTable.createdAt })
      .from(groupMessageReactionTable)
      .innerJoin(
        groupMessageTable,
        eq(groupMessageReactionTable.messageId, groupMessageTable.id),
      )
      .where(eq(groupMessageTable.groupId, groupId))
      .orderBy(desc(groupMessageReactionTable.createdAt))
      .limit(1),
  ]);

  return {
    tail: tailRow[0] ? tailRow[0].createdAt.getTime() : null,
    rxn: rxnRow[0] ? rxnRow[0].createdAt.getTime() : null,
  };
}

const HEAD_CACHE_SECONDS = 8;

export const groupChatRoutes = new Hono<AppBindings>()
  // Cheap "anything new?" poll: newest message + reaction markers, briefly
  // CDN-cached (Cache API) so many members' polls collapse to one edge hit.
  // Public + unauthenticated by design; keyed by the client-supplied ?id=.
  .get(
    "/groups/:tag/chat/head",
    withPublicRead(
      "fetching group chat head",
      HEAD_CACHE_SECONDS,
      async (req, env) => {
        if (!GROUP_CHAT_ENABLED) {
          return { tail: null, rxn: null };
        }
        const groupId = req.query("id");
        if (!groupId) {
          return { tail: null, rxn: null };
        }
        return readHead(env, groupId);
      },
      0,
      ["id"],
    ),
  )
  // Per-viewer reaction overlay for a set of loaded message ids (?ids=a,b,c).
  .get("/groups/:tag/chat/reactions", async (c) => {
    try {
      const guard = await guardMember(c, (uid) => `gchatrxn:${uid}`);
      if (!guard.ok) return guard.res;

      const idsParam = c.req.query("ids");
      const ids = idsParam ? idsParam.split(",").filter(Boolean) : [];
      return privateJson(
        await getGroupMessageReactions(
          resolveDb(c.env),
          ids,
          guard.userId,
          guard.groupId,
        ),
      );
    } catch (error) {
      console.error(
        "Error fetching group chat reactions:",
        formatErrorChain(error),
      );
      return privateJson({ error: INTERNAL_SERVER_ERROR }, 500);
    }
  })
  // The "who reacted" list for one message (drawer open).
  .get("/groups/:tag/chat/reactions/:messageId", async (c) => {
    try {
      const guard = await guardMember(c, (uid) => `gchatrxn:${uid}`);
      if (!guard.ok) return guard.res;

      return privateJson(
        await getGroupMessageReactors(
          resolveDb(c.env),
          c.req.param("messageId") ?? "",
          guard.groupId,
        ),
      );
    } catch (error) {
      console.error(
        "Error fetching group chat reactors:",
        formatErrorChain(error),
      );
      return privateJson({ error: INTERNAL_SERVER_ERROR }, 500);
    }
  })
  // Message reads: ?since=<cursor> live delta, else ?cursor=<cursor> history.
  .get("/groups/:tag/chat", async (c) => {
    try {
      const guard = await guardMember(c, (uid) => `gchat:${uid}`);
      if (!guard.ok) return guard.res;

      const db = resolveDb(c.env);
      const since = c.req.query("since");
      if (since) {
        return privateJson(
          await getGroupMessagesSince(db, guard.groupId, since),
        );
      }
      return privateJson(
        await getGroupMessagesPage(
          db,
          guard.groupId,
          c.req.query("cursor") ?? null,
        ),
      );
    } catch (error) {
      console.error("Error fetching group chat:", formatErrorChain(error));
      return privateJson({ error: INTERNAL_SERVER_ERROR }, 500);
    }
  });
