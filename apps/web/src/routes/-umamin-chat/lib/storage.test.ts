import { beforeEach, describe, expect, it } from "vitest";
import { loadDraft, saveDraft } from "./storage";

describe("draft storage", () => {
  beforeEach(() => localStorage.clear());

  it("returns null when nothing stored", () => {
    expect(loadDraft()).toBeNull();
  });

  it("round-trips a draft", () => {
    saveDraft({ alias: "NightOwl", avatarSeed: "abc", interests: ["music"] });
    expect(loadDraft()).toEqual({
      alias: "NightOwl",
      avatarSeed: "abc",
      interests: ["music"],
    });
  });

  it("returns null on corrupt JSON instead of throwing", () => {
    localStorage.setItem("umamin-chat:draft", "{not json");
    expect(loadDraft()).toBeNull();
  });
});
