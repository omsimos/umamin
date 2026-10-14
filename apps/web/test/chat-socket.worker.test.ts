import { env, listDurableObjectIds, SELF } from "cloudflare:test";
import { afterEach, describe, expect, it } from "vitest";
import { chatSocketApp } from "../src/api/chat-socket";
import { PROTOCOL_VERSION } from "../src/lib/chat/protocol";
import type { AppEnv } from "../src/server-lib/env";

const ORIGIN = "https://chat.test";
const HOST = "chat.test";

const upgradeHeaders = (extra: Record<string, string> = {}) => ({
  Upgrade: "websocket",
  Origin: ORIGIN,
  Host: HOST,
  ...extra,
});

const open: WebSocket[] = [];

function accept(res: Response) {
  const ws = res.webSocket;
  if (!ws) throw new Error(`expected a webSocket, got ${res.status}`);
  ws.accept();
  open.push(ws);
  return ws;
}

function nextFrame(ws: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve) =>
    ws.addEventListener(
      "message",
      (e) => resolve(JSON.parse(e.data as string)),
      { once: true },
    ),
  );
}

function closeCode(ws: WebSocket): Promise<number> {
  return new Promise((resolve) =>
    ws.addEventListener("close", (e) => resolve(e.code), { once: true }),
  );
}

afterEach(() => {
  for (const ws of open.splice(0)) {
    try {
      ws.close(1000);
    } catch {
      // Already closed by the server.
    }
  }
});

describe("chat socket routes", () => {
  it("hands a usable socket through the security-headers middleware", async () => {
    const res = await SELF.fetch(`${ORIGIN}/api/chat/lobby`, {
      headers: upgradeHeaders(),
    });
    expect(res.status).toBe(101);
    const ws = accept(res);
    const reply = nextFrame(ws);
    ws.send(
      JSON.stringify({
        t: "join",
        v: PROTOCOL_VERSION,
        sessionId: crypto.randomUUID(),
        secret: crypto.randomUUID(),
        alias: "",
        avatarSeed: "seed",
        interests: [`route-${crypto.randomUUID()}`],
      }),
    );
    expect(await reply).toMatchObject({ t: "waiting" });
  });

  it("answers a plain GET with 426", async () => {
    const res = await SELF.fetch(`${ORIGIN}/api/chat/lobby`, {
      headers: { Origin: ORIGIN, Host: HOST },
    });
    expect(res.status).toBe(426);
  });

  it("refuses a cross-site upgrade with 403", async () => {
    const res = await SELF.fetch(`${ORIGIN}/api/chat/lobby`, {
      headers: upgradeHeaders({ Origin: "https://evil.test" }),
    });
    expect(res.status).toBe(403);
    expect(res.webSocket).toBeNull();
  });

  // A browser can't see the status of a refused upgrade, so the refusal is a
  // close code on an accepted socket, and the lobby is never reached.
  it("refuses with 4404 while the flag is off, without reaching the lobby", async () => {
    const before = (await listDurableObjectIds(env.CHAT_LOBBY)).length;
    const off = { ...(env as unknown as AppEnv), FLAGS_FORCE_ON: "" };
    const res = await chatSocketApp.request(
      "/chat/lobby",
      { headers: upgradeHeaders() },
      off,
    );
    expect(res.status).toBe(101);
    const ws = res.webSocket;
    if (!ws) throw new Error("expected a webSocket");
    const code = closeCode(ws);
    ws.accept();
    expect(await code).toBe(4404);
    expect((await listDurableObjectIds(env.CHAT_LOBBY)).length).toBe(before);
  });

  it("404s a malformed matchId without creating an object", async () => {
    const before = (await listDurableObjectIds(env.CHAT_ROOM)).length;
    const res = await SELF.fetch(`${ORIGIN}/api/chat/room/not-a-uuid`, {
      headers: upgradeHeaders(),
    });
    expect(res.status).toBe(404);
    expect((await listDurableObjectIds(env.CHAT_ROOM)).length).toBe(before);
  });

  it("closes a socket to a room that was never created with 4404", async () => {
    const res = await SELF.fetch(
      `${ORIGIN}/api/chat/room/${crypto.randomUUID()}`,
      { headers: upgradeHeaders() },
    );
    expect(res.status).toBe(101);
    const ws = res.webSocket;
    if (!ws) throw new Error("expected a webSocket");
    const code = closeCode(ws);
    ws.accept();
    expect(await code).toBe(4404);
  });
});
