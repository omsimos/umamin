import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// "Feature flags gate production only" is enforced by wrangler.jsonc, not by
// code: the staging env sets FLAGS_FORCE_ON, production deliberately does not.
// That makes it exactly the kind of invariant a config copy-paste breaks
// silently — adding FLAGS_FORCE_ON to the production block would launch the
// Umamin Pro offer to everyone, no code change and no review signal.

// wrangler.jsonc has `//` line comments and quoted URLs containing `//`, so
// strip only the comments that start outside a string.
function parseJsonc(source: string): unknown {
  const stripped = source
    .split("\n")
    .map((line) => {
      let inString = false;
      for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        if (char === '"' && line[i - 1] !== "\\") inString = !inString;
        if (!inString && char === "/" && line[i + 1] === "/") {
          return line.slice(0, i);
        }
      }
      return line;
    })
    .join("\n");
  return JSON.parse(stripped);
}

type EnvBlock = {
  vars?: Record<string, string>;
  durable_objects?: { bindings: { name: string; class_name: string }[] };
  unsafe?: { bindings: { name: string; namespace_id: string }[] };
};

type WranglerConfig = {
  exports?: Record<string, { type: string; storage?: string }>;
  env: Record<string, EnvBlock>;
};

// vitest roots at apps/web (import.meta.url is not a file: URL under jsdom).
const config = parseJsonc(
  readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf8"),
) as WranglerConfig;

describe("wrangler feature-flag vars", () => {
  it("does not force any flag on in production", () => {
    expect(config.env.production?.vars).not.toHaveProperty("FLAGS_FORCE_ON");
  });

  // The preview host is where Pro is demoed and worked on, so the offer must
  // stay visible there regardless of the PostHog rollout.
  it("forces the Pro offer on in staging", () => {
    expect(config.env.staging?.vars?.FLAGS_FORCE_ON).toContain("umamin-pro");
  });

  // Covers and down-ranking are previewed and QA'd on staging before the
  // production flag is flipped.
  it("forces content moderation on in staging", () => {
    expect(config.env.staging?.vars?.FLAGS_FORCE_ON).toContain(
      "content-moderation",
    );
  });

  it("forces Umamin Chat on in staging", () => {
    expect(config.env.staging?.vars?.FLAGS_FORCE_ON).toContain("umamin-chat");
  });

  // Both environments report into one PostHog project, so the property that
  // separates them has to differ — and production is the gated one.
  it("tags the two environments distinctly", () => {
    expect(config.env.staging?.vars?.POSTHOG_ENV).toBe("staging");
    expect(config.env.production?.vars?.POSTHOG_ENV).toBe("production");
  });
});

// durable_objects bindings are NOT inheritable: an env block without them
// deploys a Worker whose chat routes throw on `env.CHAT_ROOM`.
describe("wrangler Umamin Chat bindings", () => {
  const chatBindings = (env: string) =>
    Object.fromEntries(
      (config.env[env]?.durable_objects?.bindings ?? []).map((b) => [
        b.name,
        b.class_name,
      ]),
    );

  it.each(["staging", "production"])("binds both chat objects in %s", (env) => {
    expect(chatBindings(env)).toMatchObject({
      CHAT_LOBBY: "ChatLobby",
      CHAT_ROOM: "ChatRoom",
    });
  });

  it("declares both classes as SQLite-backed exports", () => {
    expect(config.exports?.ChatLobby).toMatchObject({ storage: "sqlite" });
    expect(config.exports?.ChatRoom).toMatchObject({ storage: "sqlite" });
  });

  // Rate-limit namespace ids are account-global; sharing one would let staging
  // traffic drain production's connect budget.
  it("gives each environment its own connect limiter", () => {
    const id = (env: string) =>
      config.env[env]?.unsafe?.bindings.find(
        (b) => b.name === "RL_CHAT_CONNECT",
      )?.namespace_id;
    expect(id("staging")).toBeDefined();
    expect(id("production")).toBeDefined();
    expect(id("staging")).not.toBe(id("production"));
  });
});
