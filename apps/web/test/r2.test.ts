import { describe, expect, it } from "vitest";
import type { AppEnv } from "../src/server-lib/env";
import { createR2 } from "../src/server-lib/r2";

const wellFormed = {
  R2_ACCOUNT_ID: "a".repeat(32),
  R2_ACCESS_KEY_ID: "b".repeat(32),
  R2_SECRET_ACCESS_KEY: "c".repeat(64),
  R2_BUCKET: "umamin",
  R2_PUBLIC_URL: "https://cdn.example.com",
};

const env = (overrides: Partial<AppEnv> = {}) =>
  ({ ...wellFormed, ...overrides }) as unknown as AppEnv;

describe("createR2", () => {
  it("builds a client when the credentials are well formed", () => {
    expect(createR2(env())).not.toBeNull();
  });

  it("returns null when R2 config is absent", () => {
    expect(createR2(env({ R2_BUCKET: undefined }))).toBeNull();
  });

  it("rejects a swapped access-key/secret pair", () => {
    expect(
      createR2(
        env({
          R2_ACCESS_KEY_ID: wellFormed.R2_SECRET_ACCESS_KEY,
          R2_SECRET_ACCESS_KEY: wellFormed.R2_ACCESS_KEY_ID,
        }),
      ),
    ).toBeNull();
  });
});
