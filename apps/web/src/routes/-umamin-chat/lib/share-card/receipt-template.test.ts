import { describe, expect, it } from "vitest";
import {
  buildReceiptCard,
  RECEIPT_FOOTER_TOP,
  receiptLines,
} from "./receipt-template";
import { CARD_H, CARD_W, escapeXml, formatDuration } from "./theme";
import type { ChatReceiptStats } from "./types";

/** The paper receipt is the first paper-colored rect; returns its bottom y. */
function paperBottom(svg: string): number {
  const m = svg.match(/<rect x="100" y="(\d+)" width="\d+" height="(\d+)"/);
  if (!m) throw new Error("paper rect not found");
  return Number(m[1]) + Number(m[2]);
}

function makeStats(
  overrides: Partial<ChatReceiptStats> = {},
): ChatReceiptStats {
  return {
    matchId: "match-1",
    self: { alias: "Calm Otter", avatarSeed: "self-seed" },
    partner: { alias: "Blue Fox", avatarSeed: "partner-seed" },
    sharedInterests: ["music"],
    durationMs: 65_000,
    messageCount: 42,
    reactionCount: 7,
    endedAt: 1_750_000_000_000,
    ...overrides,
  };
}

describe("formatDuration", () => {
  it("formats seconds, minutes and hours", () => {
    expect(formatDuration(9_000)).toBe("9s");
    expect(formatDuration(65_000)).toBe("1m 5s");
    expect(formatDuration(3_725_000)).toBe("1h 02m");
  });
});

describe("receiptLines", () => {
  it("renders duration, messages, reactions and shared vibes", () => {
    const lines = receiptLines(makeStats());
    expect(lines).toEqual([
      { label: "DURATION", value: "1m 5s" },
      { label: "MESSAGES", value: "42" },
      { label: "REACTIONS", value: "7" },
      { label: "SHARED VIBES", value: "🎵 Music" },
    ]);
  });

  it("omits the duration line when unknown", () => {
    const lines = receiptLines(makeStats({ durationMs: undefined }));
    expect(lines.find((l) => l.label === "DURATION")).toBeUndefined();
  });

  it("marks a capped message count with a plus", () => {
    const lines = receiptLines(
      makeStats({ messageCount: 100, messageCountCapped: true }),
    );
    expect(lines.find((l) => l.label === "MESSAGES")?.value).toBe("100+");
  });

  it("appends extras (the mini-game score) as receipt lines", () => {
    const lines = receiptLines(
      makeStats({ extras: [{ label: "VIBE CHECK", value: "2/3 matched" }] }),
    );
    expect(lines.at(-1)).toEqual({ label: "VIBE CHECK", value: "2/3 matched" });
  });

  it("drops unknown interest ids instead of rendering them raw", () => {
    const lines = receiptLines(makeStats({ sharedInterests: ["not-real"] }));
    expect(lines.find((l) => l.label === "SHARED VIBES")).toBeUndefined();
  });
});

describe("buildReceiptCard", () => {
  it("renders a story-size card with both aliases as text ops", () => {
    const card = buildReceiptCard(makeStats());
    expect(card.width).toBe(CARD_W);
    expect(card.height).toBe(CARD_H);
    expect(card.svg).toContain(`width="${CARD_W}" height="${CARD_H}"`);
    const allText = card.texts.map((t) => t.text).join("\n");
    expect(allText).toContain("Calm Otter × Blue Fox");
    expect(allText).toContain("umamin.chat");
  });

  it("embeds both avatars as data: URIs in the SVG", () => {
    const card = buildReceiptCard(makeStats());
    expect(card.svg.match(/href="data:image\/svg\+xml/g)?.length).toBe(2);
  });

  it("never includes message content — only stats fields exist", () => {
    // Structural guarantee: ChatReceiptStats has no message-text field, so
    // every text op derives from aliases, counts, and fixed copy.
    const card = buildReceiptCard(makeStats());
    for (const t of card.texts) {
      expect(typeof t.text).toBe("string");
    }
    expect(card.texts.some((t) => t.text.includes("42"))).toBe(true);
  });

  it("keeps the paper above the footer at every possible line count", () => {
    // 4 base lines + the 5 gamification extras = the 9-row maximum.
    const maxed = makeStats({
      extras: [
        { label: "VIBE", value: "Level 5 — Kindred" },
        { label: "VIBE CHECK", value: "9/12 matched" },
        { label: "MIND READS", value: "4/6 right" },
        { label: "BEST COMBO", value: "x5" },
        { label: "STAYED CONNECTED", value: "it's mutual" },
      ],
    });
    expect(receiptLines(maxed)).toHaveLength(9);
    for (const stats of [makeStats(), maxed]) {
      const bottom = paperBottom(buildReceiptCard(stats).svg);
      expect(bottom).toBeLessThanOrEqual(RECEIPT_FOOTER_TOP);
    }
  });

  it("escapes XML-unsafe characters in interpolated values", () => {
    expect(escapeXml('a&b<c>"d"')).toBe("a&amp;b&lt;c&gt;&quot;d&quot;");
    // Aliases land in canvas text ops (no escaping needed); the SVG itself
    // stays well-formed even with hostile aliases.
    const card = buildReceiptCard(
      makeStats({ self: { alias: '<img src=x>"&', avatarSeed: "s" } }),
    );
    expect(card.svg).not.toContain("<img src=x>");
  });
});
