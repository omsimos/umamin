import { describe, expect, it } from "vitest";
import changelogMarkdown from "../../../../CHANGELOG.md?raw";
import { formatReleaseDate, parseChangelog, tokenizeInline } from "./changelog";

const SAMPLE = `# Changelog

Each release groups its changes under the following sections.

- **Added** — new features and capabilities.

## [2.0.0] - 2026-10-24

### Added

- Longer messages.
- A changelog page.

### Fixed

- A bug that wrapped
  onto a second line.

## [1.0.0] - 2026-01-05

A summary paragraph that
spans two lines.

### Changed

- Something changed.

[2.0.0]: https://github.com/omsimos/umamin/compare/v1.0.0...v2.0.0
`;

describe("parseChangelog", () => {
  const releases = parseChangelog(SAMPLE);

  it("skips the preamble above the first release", () => {
    expect(releases.map((r) => r.version)).toEqual(["2.0.0", "1.0.0"]);
  });

  it("groups items under their section", () => {
    expect(releases[0].sections.map((s) => s.title)).toEqual([
      "Added",
      "Fixed",
    ]);
    expect(releases[0].sections[0].items).toEqual([
      "Longer messages.",
      "A changelog page.",
    ]);
  });

  it("joins wrapped bullets and summary lines", () => {
    expect(releases[0].sections[1].items).toEqual([
      "A bug that wrapped onto a second line.",
    ]);
    expect(releases[1].summary).toBe(
      "A summary paragraph that spans two lines.",
    );
  });

  it("ignores link reference definitions", () => {
    expect(releases[1].sections[0].items).toEqual(["Something changed."]);
  });

  it("parses every release in the real changelog", () => {
    const parsed = parseChangelog(changelogMarkdown);

    expect(parsed.length).toBeGreaterThan(0);
    for (const release of parsed) {
      expect(release.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(release.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // The page keys sections by title and items by text.
      const titles = release.sections.map((s) => s.title);
      expect(new Set(titles).size).toBe(titles.length);
      for (const s of release.sections) {
        expect(new Set(s.items).size).toBe(s.items.length);
      }
      const items = release.sections.flatMap((s) => s.items);
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) expect(item).not.toMatch(/^\s|^\[.+\]: /);
    }
  });
});

describe("formatReleaseDate", () => {
  it("formats without depending on the runtime time zone", () => {
    expect(formatReleaseDate("2026-01-05")).toBe("Jan 5, 2026");
  });
});

describe("tokenizeInline", () => {
  it("splits code, bold and links out of plain text", () => {
    expect(
      tokenizeInline("Use `/user/@you` and **bold** [docs](https://x.dev)."),
    ).toEqual([
      { type: "text", value: "Use " },
      { type: "code", value: "/user/@you" },
      { type: "text", value: " and " },
      { type: "strong", value: "bold" },
      { type: "text", value: " " },
      { type: "link", value: "docs", href: "https://x.dev" },
      { type: "text", value: "." },
    ]);
  });

  it("renders links with an unsafe scheme as plain text", () => {
    expect(tokenizeInline("[click](javascript:alert(1))")).toEqual([
      { type: "text", value: "click" },
      { type: "text", value: ")" },
    ]);
  });
});
