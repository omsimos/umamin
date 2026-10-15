import { describe, expect, it } from "vitest";
import { inviteCodeFor } from "./invite";

describe("inviteCodeFor", () => {
  it("is deterministic for a secret and differs across secrets", async () => {
    const first = await inviteCodeFor("secret-one");
    expect(await inviteCodeFor("secret-one")).toBe(first);
    expect(await inviteCodeFor("secret-two")).not.toBe(first);
  });

  it("is always 10 base36 characters", async () => {
    const secrets = Array.from({ length: 200 }, (_, i) => `s-${i}`);
    const codes = await Promise.all(secrets.map(inviteCodeFor));
    for (const code of codes) expect(code).toMatch(/^[0-9a-z]{10}$/);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
