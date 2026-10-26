export type ChangelogSection = { title: string; items: string[] };

export type ChangelogRelease = {
  version: string;
  date: string | null;
  summary: string | null;
  sections: ChangelogSection[];
};

const RELEASE_HEADING = /^## \[([^\]]+)\](?: - (\d{4}-\d{2}-\d{2}))?/;
const SECTION_HEADING = /^### (.+)/;
const LIST_ITEM = /^- (.*)/;
const LINK_DEFINITION = /^\[[^\]]+\]: /;

// Parses the root CHANGELOG.md (Keep a Changelog). Everything above the first
// release heading is contributor guidance, not release notes, so it's skipped.
// Older releases wrap long bullets onto indented lines and some open with a
// summary paragraph before their first section.
export function parseChangelog(markdown: string): ChangelogRelease[] {
  const releases: ChangelogRelease[] = [];
  let release: ChangelogRelease | null = null;
  let section: ChangelogSection | null = null;
  let afterBlank = false;

  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trimEnd();

    const releaseMatch = line.match(RELEASE_HEADING);
    if (releaseMatch) {
      release = {
        version: releaseMatch[1],
        date: releaseMatch[2] ?? null,
        summary: null,
        sections: [],
      };
      releases.push(release);
      section = null;
      afterBlank = false;
      continue;
    }
    if (!release || LINK_DEFINITION.test(line)) continue;

    if (!line.trim()) {
      afterBlank = true;
      continue;
    }

    const sectionMatch = line.match(SECTION_HEADING);
    if (sectionMatch) {
      section = { title: sectionMatch[1].trim(), items: [] };
      release.sections.push(section);
    } else if (section) {
      const itemMatch = line.match(LIST_ITEM);
      const last = section.items.length - 1;
      if (itemMatch) {
        section.items.push(itemMatch[1].trim());
      } else if (last >= 0 && !afterBlank) {
        section.items[last] = `${section.items[last]} ${line.trim()}`;
      }
    } else {
      release.summary = release.summary
        ? `${release.summary} ${line.trim()}`
        : line.trim();
    }
    afterBlank = false;
  }

  return releases;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Formatted by hand: Intl output can differ between workerd and the browser,
// which would be a hydration mismatch.
export function formatReleaseDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

export type InlineToken =
  | { type: "text"; value: string }
  | { type: "code"; value: string }
  | { type: "strong"; value: string }
  | { type: "link"; value: string; href: string };

const INLINE = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

// The changelog only uses inline code, bold and links inside bullets.
export function tokenizeInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let cursor = 0;

  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      tokens.push({ type: "text", value: text.slice(cursor, index) });
    }
    const [whole, code, strong, label, href] = match;
    if (code !== undefined) {
      tokens.push({ type: "code", value: code });
    } else if (strong !== undefined) {
      tokens.push({ type: "strong", value: strong });
    } else if (/^(https?:\/\/|\/)/.test(href)) {
      tokens.push({ type: "link", value: label, href });
    } else {
      tokens.push({ type: "text", value: label });
    }
    cursor = index + whole.length;
  }

  if (cursor < text.length) {
    tokens.push({ type: "text", value: text.slice(cursor) });
  }
  return tokens;
}
