import { env } from "cloudflare:test";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

// resolveDmPeer reads Turso, which the workerd pool can't run, so the access
// answer is injected. Everything after it (the route's branching, the headers it
// forwards, the real DmRoom) runs for real.
const resolveDmPeer = vi.hoisted(() => vi.fn());
vi.mock("../src/server-lib/dm/access", () => ({ resolveDmPeer }));

import { dmSocketApp } from "../src/api/dm-socket";
import {
  CLOSE,
  DM_CLOSED,
  DM_PROTOCOL_VERSION,
  type DmServerFrame,
} from "../src/lib/dm/protocol";
import type { AppBindings } from "../src/server-lib/context";

function app(userId: string) {
  return new Hono<AppBindings>()
    .use("*", async (c, next) => {
      c.set("getSession", async () => ({
        session: { id: "s", userId, expiresAt: Date.now() + 1e9 },
        user: { id: userId } as never,
        source: "cookie" as const,
      }));
      await next();
    })
    .route("/api", dmSocketApp);
}

function upgrade(userId: string) {
  return app(userId).fetch(
    new Request("https://chat.test/api/dm/socket/pal", {
      headers: {
        Upgrade: "websocket",
        Origin: "https://chat.test",
        Host: "chat.test",
      },
    }),
    env as never,
  );
}

function access(over: {
  canMessage: boolean;
  hasThread: boolean;
  blocked: boolean;
}) {
  return {
    peer: {
      id: `p-${crypto.randomUUID()}`,
      username: "pal",
      displayName: null,
      imageUrl: null,
    },
    ...over,
  };
}

function closeCode(res: Response): Promise<number> {
  const ws = res.webSocket;
  if (!ws) throw new Error(`expected a webSocket, got ${res.status}`);
  ws.accept();
  return new Promise((resolve) =>
    ws.addEventListener("close", (e) => resolve(e.code), { once: true }),
  );
}

function syncFrame(res: Response): Promise<DmServerFrame & { t: "sync" }> {
  const ws = res.webSocket;
  if (res.status !== 101 || !ws) {
    throw new Error(`expected an upgrade, got ${res.status}`);
  }
  ws.accept();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("no sync frame")), 2000);
    ws.addEventListener("message", (e) => {
      const frame = JSON.parse(e.data as string) as DmServerFrame;
      if (frame.t === "sync") {
        clearTimeout(timer);
        ws.close(1000, "bye");
        resolve(frame);
      }
    });
    ws.send(JSON.stringify({ t: "hi", v: DM_PROTOCOL_VERSION }));
  });
}

describe("dm socket access", () => {
  beforeEach(() => {
    resolveDmPeer.mockReset();
  });

  it("closes as gone when the peer can't be resolved", async () => {
    resolveDmPeer.mockResolvedValue(null);
    expect(await closeCode(await upgrade("me-1"))).toBe(CLOSE.GONE);
  });

  it("closes a blocked pair even when a thread exists", async () => {
    resolveDmPeer.mockResolvedValue(
      access({ canMessage: false, hasThread: true, blocked: true }),
    );
    expect(await closeCode(await upgrade("me-2"))).toBe(DM_CLOSED);
  });

  it("closes when there is no mutual follow and no conversation", async () => {
    resolveDmPeer.mockResolvedValue(
      access({ canMessage: false, hasThread: false, blocked: false }),
    );
    expect(await closeCode(await upgrade("me-3"))).toBe(DM_CLOSED);
  });

  it("opens an existing conversation read-only after an unfollow", async () => {
    resolveDmPeer.mockResolvedValue(
      access({ canMessage: false, hasThread: true, blocked: false }),
    );
    const sync = await syncFrame(await upgrade("me-4"));
    expect(sync.meta.canSend).toBe(false);
  });

  it("opens a conversation between mutual followers as sendable", async () => {
    resolveDmPeer.mockResolvedValue(
      access({ canMessage: true, hasThread: false, blocked: false }),
    );
    const sync = await syncFrame(await upgrade("me-5"));
    expect(sync.meta.canSend).toBe(true);
  });
});
