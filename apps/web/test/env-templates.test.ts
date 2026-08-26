import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The public .env.<mode> files are COMMITTED and are what a Workers Builds
// deploy actually ships (it builds from a clean clone), so they are the only
// record of what each environment gets. A variable read by the client but
// missing from one of them is a silently disabled feature in that environment,
// which has already happened once via a dashboard build variable that was never
// set. See ENVIRONMENT.md.
const root = join(__dirname, "..");
const read = (file: string) => readFileSync(join(root, file), "utf-8");

const MODE_FILES = [
  ".env.development",
  ".env.staging",
  ".env.production",
] as const;

const assignedKeys = (contents: string) =>
  new Set(
    contents
      .split("\n")
      .map((line) => /^([A-Z_0-9]+)=/.exec(line)?.[1])
      .filter((key): key is string => !!key),
  );

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(path, acc);
    else if (/\.tsx?$/.test(entry.name)) acc.push(path);
  }
  return acc;
}

function referencedViteVars(): Set<string> {
  const referenced = new Set<string>();
  for (const file of sourceFiles(join(root, "src"))) {
    for (const match of readFileSync(file, "utf-8").matchAll(
      /import\.meta\.env\.(VITE_[A-Z_0-9]+)/g,
    )) {
      // Not an env variable: vite.config.ts `define`s it from CHANGELOG.md.
      if (match[1] !== "VITE_APP_VERSION") referenced.add(match[1] as string);
    }
  }
  return referenced;
}

describe("env files", () => {
  it("gives every environment the same set of public variables", () => {
    const [dev, staging, production] = MODE_FILES.map((file) =>
      [...assignedKeys(read(file))].sort(),
    );

    expect(staging).toEqual(dev);
    expect(production).toEqual(dev);
  });

  it("declares every VITE_* variable the client reads, in every environment", () => {
    const referenced = referencedViteVars();
    expect(referenced.size).toBeGreaterThan(0);

    for (const file of MODE_FILES) {
      const declared = assignedKeys(read(file));
      expect([...referenced].filter((key) => !declared.has(key))).toEqual([]);
    }
  });

  it("keeps secrets out of the committed public files", () => {
    // These are embedded in the browser bundle verbatim. A non-VITE_ key here
    // is either dead weight or a leaked secret.
    for (const file of MODE_FILES) {
      const nonPublic = [...assignedKeys(read(file))].filter(
        (key) => !key.startsWith("VITE_"),
      );
      expect(nonPublic).toEqual([]);
    }
  });

  it("documents every Worker secret the Secrets type declares", () => {
    const declared = [
      ...read("src/server-lib/env.ts").matchAll(/^ {2}([A-Z_0-9]+): string;/gm),
    ].map((match) => match[1] as string);

    // `.dev.vars.example` leaves the optional Lemon Squeezy block commented out,
    // so match commented assignments too — the name being present is the point.
    const example = read(".dev.vars.example");
    expect(declared.length).toBeGreaterThan(0);
    expect(
      declared.filter((key) => !new RegExp(`^#? *${key}=`, "m").test(example)),
    ).toEqual([]);
  });

  it("has no base env file that would shadow a mode file", () => {
    // vite and wrangler both load .env → .env.local → .env.<mode>, so a stray
    // .env.local outranks .env in EVERY mode, including a production build.
    const present = readdirSync(root).filter((name) => /^\.env/.test(name));
    expect(
      present.filter((name) => name === ".env" || name.endsWith(".local")),
    ).toEqual([]);
  });
});
