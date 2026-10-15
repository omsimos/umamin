import { describe, expect, it } from "vitest";
import { groupReactions } from "./reactions";

describe("groupReactions", () => {
  it("returns no groups for no reactions", () => {
    expect(groupReactions([])).toEqual([]);
  });

  it("collapses a shared emoji into one group with a count", () => {
    expect(
      groupReactions([
        { emoji: "❤️", by: "self" },
        { emoji: "❤️", by: "partner" },
      ]),
    ).toEqual([{ emoji: "❤️", count: 2 }]);
  });

  it("keeps distinct emojis as separate groups in first-seen order", () => {
    expect(
      groupReactions([
        { emoji: "🔥", by: "partner" },
        { emoji: "❤️", by: "self" },
      ]),
    ).toEqual([
      { emoji: "🔥", count: 1 },
      { emoji: "❤️", count: 1 },
    ]);
  });
});
