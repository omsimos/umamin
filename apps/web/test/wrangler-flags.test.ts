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

type WranglerConfig = {
  env: Record<string, { vars?: Record<string, string> }>;
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

  // Both environments report into one PostHog project, so the property that
  // separates them has to differ — and production is the gated one.
  it("tags the two environments distinctly", () => {
    expect(config.env.staging?.vars?.POSTHOG_ENV).toBe("staging");
    expect(config.env.production?.vars?.POSTHOG_ENV).toBe("production");
  });
});
