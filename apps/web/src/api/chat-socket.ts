import { type Context, Hono } from "hono";
import { CHAT_LOCATION_HINT } from "../server-lib/chat/lobby";
import { hashSecret } from "../server-lib/chat/secret";
import type { AppBindings } from "../server-lib/context";
import { originMatchesHost } from "../server-lib/csrf";
import { isUmaminChatEnabled } from "../server-lib/flags";
import { canonicalizeIp, extractClientIp } from "../server-lib/ip";
import { checkRateLimit } from "../server-lib/ratelimit";

/** The single queue. Versioned so a breaking lobby change can start a fresh
 *  object instead of inheriting old attachments. */
export const LOBBY_NAME = "lobby:v1";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Stub = { fetch(request: Request): Promise<Response> };

/**
 * Validates an upgrade and hands it to a chat Durable Object. The global IP
 * denylist already ran (it covers /api). After the 101 the frames flow between
 * the browser and the object; this Worker only proxies.
 */
async function upgrade(c: Context<AppBindings>, stub: () => Stub) {
  if (c.req.header("upgrade")?.toLowerCase() !== "websocket") {
    return c.json({ error: "Expected WebSocket" }, 426);
  }
  // CSRF for sockets: an upgrade is a GET, so csrfOriginCheck skips it, and
  // without this any site could open a chat socket from a visitor's browser.
  if (!originMatchesHost(c)) return c.json({ error: "Forbidden" }, 403);
  if (!(await isUmaminChatEnabled(c.env))) {
    return c.json({ error: "Not found" }, 404);
  }
  const ip = canonicalizeIp(extractClientIp((name) => c.req.header(name)));
  if (!(await checkRateLimit(c.env, "chat-connect", `chatconn:${ip}`))) {
    return c.json({ error: "Too many requests" }, 429);
  }
  const headers = new Headers(c.req.raw.headers);
  // A hash, not the address: the lobby only needs a per-IP bucket key, and it
  // keeps it in socket attachments.
  headers.set("x-umamin-ip", (await hashSecret(ip)).slice(0, 16));
  return stub().fetch(new Request(c.req.raw, { headers }));
}

export const chatSocketApp = new Hono<AppBindings>()
  .get("/chat/lobby", (c) =>
    upgrade(c, () =>
      c.env.CHAT_LOBBY.get(c.env.CHAT_LOBBY.idFromName(LOBBY_NAME), {
        locationHint: CHAT_LOCATION_HINT,
      }),
    ),
  )
  .get("/chat/room/:matchId", async (c) => {
    const matchId = c.req.param("matchId");
    // Unknown ids never reach an object, so probing can't instantiate one.
    if (!UUID.test(matchId)) return c.json({ error: "Not found" }, 404);
    return upgrade(c, () =>
      c.env.CHAT_ROOM.get(c.env.CHAT_ROOM.idFromName(matchId), {
        locationHint: CHAT_LOCATION_HINT,
      }),
    );
  });
