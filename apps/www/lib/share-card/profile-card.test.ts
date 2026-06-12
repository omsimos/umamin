import { describe, expect, it } from "vitest";
import { type ProfileCardUser, profileCardModel } from "./profile-card";

function makeUser(overrides: Partial<ProfileCardUser> = {}): ProfileCardUser {
  return {
    username: "joshxfi",
    displayName: "Josh",
    bio: "building things",
    question: "Send me an anonymous message!",
    followerCount: 0,
    ...overrides,
  };
}

describe("profileCardModel", () => {
  it("prefers the display name and falls back to the username", () => {
    expect(profileCardModel(makeUser()).name).toBe("Josh");
    expect(profileCardModel(makeUser({ displayName: "  " })).name).toBe(
      "joshxfi",
    );
    expect(profileCardModel(makeUser({ displayName: null })).name).toBe(
      "joshxfi",
    );
  });

  it("builds the handle and initials", () => {
    const model = profileCardModel(makeUser());
    expect(model.handle).toBe("@joshxfi");
    expect(model.initials).toBe("JO");
  });

  it("omits the bio when empty and truncates a long one", () => {
    expect(profileCardModel(makeUser({ bio: "  " })).bio).toBeUndefined();
    const long = "x".repeat(120);
    const model = profileCardModel(makeUser({ bio: long }));
    expect(model.bio?.length).toBeLessThanOrEqual(80);
    expect(model.bio?.endsWith("…")).toBe(true);
  });

  it("formats follower counts compactly and omits zero", () => {
    expect(
      profileCardModel(makeUser({ followerCount: 0 })).followers,
    ).toBeUndefined();
    expect(profileCardModel(makeUser({ followerCount: 1 })).followers).toBe(
      "1 follower",
    );
    expect(profileCardModel(makeUser({ followerCount: 1234 })).followers).toBe(
      "1.2K followers",
    );
  });

  it("truncates the question to its settings cap", () => {
    const model = profileCardModel(makeUser({ question: "q".repeat(200) }));
    expect(model.question.length).toBeLessThanOrEqual(150);
  });
});
