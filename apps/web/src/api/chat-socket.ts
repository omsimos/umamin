import { type Context, Hono } from "hono";
import { CHAT_STATS_MAX_AGE } from "../lib/chat/constants";
import { CLOSE } from "../lib/chat/protocol";
import { CHAT_LOCATION_HINT } from "../server-lib/chat/lobby";
import { hashSecret } from "../server-lib/chat/secret";
import type { AppBindings } from "../server-lib/context";
import { originMatchesHost } from "../server-lib/csrf";
import type { AppEnv } from "../server-lib/env";
import { NOT_FOUND_ERROR } from "../server-lib/errors";
import { isUmaminChatEnabled } from "../server-lib/flags";
import { canonicalizeIp, extractClientIp } from "../server-lib/ip";
import { checkRateLimit } from "../server-lib/ratelimit";
import { withPublicRead } from "../server-lib/read-route";

/** The single queue. Versioned so a breaking lobby change can start a fresh
 *  object instead of inheriting old attachments. */
export const LOBBY_NAME = "lobby:v1";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Stub = { fetch(request: Request): Promise<Response> };

const lobbyStub = (env: AppEnv) =>
  env.CHAT_LOBBY.get(env.CHAT_LOBBY.idFromName(LOBBY_NAME), {
    locationHint: CHAT_LOCATION_HINT,
  });

/** A browser can't read the status of a refused upgrade (it only sees 1006),
 *  so refusals the client must act on are delivered as a close code on an
 *  accepted socket instead. */
function refuse(code: number, reason: string) {
  const { 0: client, 1: server } = new WebSocketPair();
  server.accept();
  server.close(code, reason);
  return new Response(null, { status: 101, webSocket: client });
}

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
  if (!(await isUmaminChatEnabled(c.env))) return refuse(CLOSE.GONE, "gone");
  const ip = canonicalizeIp(extractClientIp((name) => c.req.header(name)));
  if (!(await checkRateLimit(c.env, "chat-connect", `chatconn:${ip}`))) {
    return refuse(CLOSE.TOO_MANY, "too many");
  }
  const headers = new Headers(c.req.raw.headers);
  // A hash, not the address: the lobby only needs a per-IP bucket key, and it
  // keeps it in socket attachments.
  headers.set("x-umamin-ip", (await hashSecret(ip)).slice(0, 16));
  return stub().fetch(new Request(c.req.raw, { headers }));
}

export const chatSocketApp = new Hono<AppBindings>()
  .get("/chat/lobby", (c) => upgrade(c, () => lobbyStub(c.env)))
  // The headcount on /chat. Edge-cached with no query params in the key, so
  // page views reach the lobby at most once per TTL per colo.
  .get(
    "/chat/stats",
    withPublicRead(
      "fetching chat stats",
      CHAT_STATS_MAX_AGE,
      async (_req, env) => {
        if (!(await isUmaminChatEnabled(env))) {
          return Response.json({ error: NOT_FOUND_ERROR }, { status: 404 });
        }
        return lobbyStub(env).getStats();
      },
      CHAT_STATS_MAX_AGE,
      [],
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
