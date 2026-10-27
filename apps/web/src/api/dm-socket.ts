import { Hono } from "hono";
import { CLOSE } from "../lib/chat/protocol";
import { dmPair, dmRoomName } from "../lib/dm/pair";
import { DM_CLOSED } from "../lib/dm/protocol";
import type { AppBindings } from "../server-lib/context";
import { originMatchesHost } from "../server-lib/csrf";
import { resolveDmPeer } from "../server-lib/dm/access";
import { DM_HEADERS } from "../server-lib/dm/room";
import { isDmEnabled } from "../server-lib/flags";
import { checkRateLimit } from "../server-lib/ratelimit";
import { refuse } from "./chat-socket";
import { formatUsername, getSessionFrom, resolveDb } from "./routes/_shared";

/**
 * Opens a direct-message socket with `username`. The viewer comes from the
 * session cookie and access is checked here, so the DmRoom only ever sees
 * requests this route forwarded, with the answer in headers it sets.
 */
export const dmSocketApp = new Hono<AppBindings>().get(
  "/dm/socket/:username",
  async (c) => {
    if (c.req.header("upgrade")?.toLowerCase() !== "websocket") {
      return c.json({ error: "Expected WebSocket" }, 426);
    }
    // An upgrade is a GET, so csrfOriginCheck skips it; without this any site
    // could open a socket with a visitor's cookie.
    if (!originMatchesHost(c)) return c.json({ error: "Forbidden" }, 403);
    if (!(await isDmEnabled(c.env))) return refuse(CLOSE.GONE, "gone");

    const { session } = await getSessionFrom(c);
    if (!session) return refuse(CLOSE.UNAUTHORIZED, "unauthorized");
    // Per user, not per IP: a school or office NAT shares one address.
    if (
      !(await checkRateLimit(c.env, "chat-connect", `dmconn:${session.userId}`))
    ) {
      return refuse(CLOSE.TOO_MANY, "too many");
    }

    const access = await resolveDmPeer(
      resolveDb(c.env),
      session.userId,
      formatUsername(c.req.param("username") ?? ""),
    );
    if (!access) return refuse(CLOSE.GONE, "gone");
    // No conversation and no mutual follow: nothing to open. An existing
    // conversation stays readable after an unfollow; a block closes it.
    if (access.blocked || (!access.canMessage && !access.hasThread)) {
      return refuse(DM_CLOSED, "closed");
    }

    const { threadId } = dmPair(session.userId, access.peer.id);
    const headers = new Headers(c.req.raw.headers);
    headers.set(DM_HEADERS.thread, threadId);
    headers.set(DM_HEADERS.user, session.userId);
    headers.set(DM_HEADERS.canSend, access.canMessage ? "1" : "0");
    const stub = c.env.DM_ROOM.get(
      c.env.DM_ROOM.idFromName(dmRoomName(threadId)),
    );
    return stub.fetch(new Request(c.req.raw, { headers }));
  },
);
