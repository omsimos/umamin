import { SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

const ORIGIN = "https://chat.test";

// Production logged "This promise was created by a request that has since
// ended, so it can never settle" from requests that joined a lookup another
// request had started. Each case ends the first request mid-lookup and checks
// that the second still gets an answer.
describe("shared lookups across requests", () => {
  beforeEach(async () => {
    await SELF.fetch(`${ORIGIN}/__test/reset`, { method: "POST" });
  });

  for (const name of ["denylist", "session", "flags"]) {
    it(`a ${name} lookup survives the request that started it ending`, async () => {
      const start = await SELF.fetch(`${ORIGIN}/__test/${name}/start`);
      expect(start.status).toBe(204);

      const join = await Promise.race([
        SELF.fetch(`${ORIGIN}/__test/${name}/join`).then(
          (res) => res.status,
          () => "rejected",
        ),
        new Promise((resolve) => setTimeout(() => resolve("hung"), 3000)),
      ]);
      expect(join).toBe(200);
    });
  }
});
