import { describe, expect, it } from "vitest";
import {
  createGroupSchema,
  formatGroupTag,
  GROUP_NAME_MAX_LENGTH,
  normalizeGroupTag,
} from "./group";
import { isReservedGroupTag } from "./server/group-reserved";

describe("formatGroupTag", () => {
  it("uppercases and trims", () => {
    expect(formatGroupTag(" bros ")).toBe("BROS");
    expect(formatGroupTag("f1re")).toBe("F1RE");
  });
});

describe("normalizeGroupTag", () => {
  it("folds leetspeak digits to their lookalike letters", () => {
    expect(normalizeGroupTag("M0D5")).toBe("MODS");
    expect(normalizeGroupTag("5T4F")).toBe("STAF");
    expect(normalizeGroupTag("BR05")).toBe("BROS");
    expect(normalizeGroupTag("13Z7")).toBe("IEZT");
  });

  it("uppercases before folding", () => {
    expect(normalizeGroupTag("br0s")).toBe("BROS");
  });

  it("leaves unfolded characters alone", () => {
    expect(normalizeGroupTag("XY9Z")).toBe("XY9Z");
    expect(normalizeGroupTag("ARCS")).toBe("ARCS");
  });
});

describe("createGroupSchema", () => {
  const valid = {
    name: "The Bros",
    description: "",
    tag: "bros",
    icon: "swords",
    accent: null,
  };

  it("accepts a valid payload", () => {
    const parsed = createGroupSchema.parse(valid);
    expect(parsed.tag).toBe("bros");
    expect(parsed.icon).toBe("swords");
  });

  it("normalizes a blank description to null and trims a real one", () => {
    expect(createGroupSchema.parse(valid).description).toBeNull();
    expect(
      createGroupSchema.parse({ ...valid, description: "  our crew  " })
        .description,
    ).toBe("our crew");
  });

  it("rejects an oversized description", () => {
    expect(() =>
      createGroupSchema.parse({ ...valid, description: "x".repeat(201) }),
    ).toThrow();
  });

  it("accepts an accent from the palette", () => {
    expect(() =>
      createGroupSchema.parse({ ...valid, accent: "rose" }),
    ).not.toThrow();
  });

  it("rejects tags that are not exactly 4 alphanumerics", () => {
    expect(() => createGroupSchema.parse({ ...valid, tag: "abc" })).toThrow();
    expect(() => createGroupSchema.parse({ ...valid, tag: "abcde" })).toThrow();
    expect(() => createGroupSchema.parse({ ...valid, tag: "ab!d" })).toThrow();
    expect(() => createGroupSchema.parse({ ...valid, tag: "ab d" })).toThrow();
  });

  it("rejects an empty or oversized name", () => {
    expect(() => createGroupSchema.parse({ ...valid, name: "  " })).toThrow();
    expect(() =>
      createGroupSchema.parse({
        ...valid,
        name: "x".repeat(GROUP_NAME_MAX_LENGTH + 1),
      }),
    ).toThrow();
  });

  it("rejects icons and accents outside the curated lists", () => {
    expect(() =>
      createGroupSchema.parse({ ...valid, icon: "biohazard" }),
    ).toThrow();
    expect(() =>
      createGroupSchema.parse({ ...valid, accent: "chartreuse" }),
    ).toThrow();
  });
});

describe("isReservedGroupTag", () => {
  it("blocks authority and brand tags", () => {
    expect(isReservedGroupTag("MODS")).toBe(true);
    expect(isReservedGroupTag("STAF")).toBe(true);
    expect(isReservedGroupTag("PLUS")).toBe(true);
  });

  it("blocks the /groups route segment", () => {
    expect(isReservedGroupTag("JOIN")).toBe(true);
  });

  it("catches leetspeak evasion via the fold", () => {
    expect(isReservedGroupTag("M0D5")).toBe(true);
    expect(isReservedGroupTag("5T4F")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isReservedGroupTag("mods")).toBe(true);
  });

  it("allows ordinary tags", () => {
    expect(isReservedGroupTag("BROS")).toBe(false);
    expect(isReservedGroupTag("PMND")).toBe(false);
    expect(isReservedGroupTag("ARCS")).toBe(false);
  });
});
