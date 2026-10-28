import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { CLOSE } from "../src/lib/dm/protocol";

// The happy path needs a session and Turso, which the workerd pool can't run;
// test/dm-room.worker.test.ts drives the room with the headers this route sets.
// These cover the refusals that happen before any database work.

const ORIGIN = "https://chat.test";

function closeCode(res: Response): Promise<number> {
  const ws = res.webSocket;
  if (!ws) throw new Error(`expected a webSocket, got ${res.status}`);
  ws.accept();
  return new Promise((resolve) =>
    ws.addEventListener("close", (e) => resolve(e.code), { once: true }),
  );
}

describe("dm socket route", () => {
  it("requires a websocket upgrade", async () => {
    const res = await SELF.fetch(`${ORIGIN}/api/dm/socket/someone`);
    expect(res.status).toBe(426);
  });

  it("refuses a cross-site upgrade", async () => {
    const res = await SELF.fetch(`${ORIGIN}/api/dm/socket/someone`, {
      headers: {
        Upgrade: "websocket",
        Origin: "https://evil.test",
        Host: "chat.test",
      },
    });
    expect(res.status).toBe(403);
  });

  it("closes a signed-out socket as unauthorized", async () => {
    const res = await SELF.fetch(`${ORIGIN}/api/dm/socket/someone`, {
      headers: { Upgrade: "websocket", Origin: ORIGIN, Host: "chat.test" },
    });
    expect(await closeCode(res)).toBe(CLOSE.UNAUTHORIZED);
  });
});
