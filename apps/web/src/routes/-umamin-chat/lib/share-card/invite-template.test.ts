import { describe, expect, it } from "vitest";
import { buildInviteCard } from "./invite-template";
import { CARD_H, CARD_W } from "./theme";

const INPUT = {
  alias: "Calm Otter",
  avatarSeed: "self-seed",
};

describe("buildInviteCard", () => {
  it("renders a story-size card with the alias, eyebrow, and sticker slot", () => {
    const card = buildInviteCard(INPUT);
    expect(card.width).toBe(CARD_W);
    expect(card.height).toBe(CARD_H);
    expect(card.svg).toContain(`width="${CARD_W}" height="${CARD_H}"`);
    const allText = card.texts.map((t) => t.text).join("\n");
    expect(allText).toContain("✦ CHAT WITH ME");
    expect(allText).toContain("with Calm Otter.");
    // No URL is painted, and the sticker guide lives ONLY on the preview
    // overlay — the shared image keeps that zone clean.
    expect(allText).not.toContain("umamin.chat/?join=");
    expect(allText).not.toContain("link sticker");
    expect(card.previewTexts?.map((t) => t.text).join("\n")).toContain(
      "your link sticker goes here",
    );
    expect(card.previewSvg).toContain("stroke-dasharray");
  });

  it("renders the sharer's interests as chips", () => {
    const card = buildInviteCard({ ...INPUT, interests: ["music", "gaming"] });
    const allText = card.texts.map((t) => t.text).join("\n");
    expect(allText).toContain("🎵 Music");
    expect(allText).toContain("🎮 Gaming");
    // Unknown ids are dropped, not rendered raw.
    const withUnknown = buildInviteCard({ ...INPUT, interests: ["nope"] });
    expect(withUnknown.texts.map((t) => t.text).join("\n")).not.toContain(
      "nope",
    );
  });

  it("embeds the avatar and renders the domain footer without a logo asset", () => {
    const card = buildInviteCard(INPUT);
    expect(card.svg).toContain('href="data:image/svg+xml');
    const allText = card.texts.map((t) => t.text).join("\n");
    expect(allText).toContain("umamin.chat");
    expect(allText).toContain("→");
  });

  it("inlines the logo asset when provided", () => {
    const card = buildInviteCard(INPUT, {
      logoDataUri: "data:image/svg+xml;utf8,%3Csvg%3E%3C/svg%3E",
    });
    expect(card.svg.match(/href="data:image\/svg\+xml/g)?.length).toBe(2);
  });
});
