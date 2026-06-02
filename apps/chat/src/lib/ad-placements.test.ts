import { describe, expect, it } from "vitest";
import { AD_CLIENT, adPlacements, adsEnabled } from "./ad-placements";

describe("ad-placements", () => {
  it("uses the umamin publisher id", () => {
    expect(AD_CLIENT).toMatch(/^ca-pub-\d+$/);
  });

  it("defines the lobby and ended placements", () => {
    expect(Object.keys(adPlacements).sort()).toEqual(["ended", "lobby"]);
    for (const p of Object.values(adPlacements)) {
      expect(typeof p.slotId).toBe("string");
      expect(typeof p.minHeight).toBe("number");
      expect(typeof p.lazy).toBe("boolean");
    }
  });

  it("disables ads under test (not a production build)", () => {
    expect(adsEnabled()).toBe(false);
  });
});
