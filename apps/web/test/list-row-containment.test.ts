import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// The long non-virtualized lists rely on the `list-row` utility (styles.css) to
// skip style/layout/paint for offscreen rows. Two halves have to stay in sync and
// BOTH fail silently: a row without the class is never skipped, and a `list-row`
// with no `--list-row-height` in its ancestry falls back to a generic 400px
// estimate that makes the scrollbar drift.
const ROOT = join(import.meta.dirname, "..");

const LISTS = [
  ["src/routes/_social/-components/post-list.tsx", 380],
  ["src/routes/_social/-components/profile-post-list.tsx", 380],
  ["src/routes/_social/-components/note-list.tsx", 300],
  ["src/routes/_social/-components/comments-list.tsx", 180],
  ["src/routes/-inbox/received-messages.tsx", 240],
  ["src/routes/-inbox/sent-messages.tsx", 320],
] as const;

const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

describe("list-row containment", () => {
  it("defines the utility with a per-list height variable", () => {
    const css = read("src/styles.css");
    expect(css).toContain("@utility list-row");
    expect(css).toContain("content-visibility: auto");
    expect(css).toContain(
      "contain-intrinsic-size: auto var(--list-row-height, 400px)",
    );
  });

  it.each(LISTS)("%s marks its rows and sets its estimate", (path, height) => {
    const source = read(path);
    expect(source).toContain('"list-row');
    expect(source).toContain(`[--list-row-height:${height}px]`);
  });

  it("has no list-row usage outside the lists that set an estimate", () => {
    const known = new Set<string>(LISTS.map(([path]) => path));
    const users = readdirSync(join(ROOT, "src"), {
      recursive: true,
      withFileTypes: true,
    })
      .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
      .map((entry) =>
        relative(ROOT, join(entry.parentPath, entry.name)).replaceAll(
          "\\",
          "/",
        ),
      )
      .filter((path) => read(path).includes('"list-row'));

    // A new list adopting the class without an estimate silently inherits the
    // generic 400px fallback — register it in LISTS with its median row height
    // rather than deleting this guard.
    expect(users.filter((path) => !known.has(path))).toEqual([]);
  });
});
