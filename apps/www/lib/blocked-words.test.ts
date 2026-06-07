import { describe, expect, it } from "vitest";
import {
  MAX_BLOCKED_WORD_LENGTH,
  MAX_BLOCKED_WORDS,
  matchesBlockedWords,
  sanitizeBlockedWords,
} from "./blocked-words";

describe("matchesBlockedWords", () => {
  it("matches case-insensitively", () => {
    expect(matchesBlockedWords("SPAMmer was here", ["spam"])).toBe(true);
    expect(matchesBlockedWords("totally fine", ["SPAM"])).toBe(false);
  });

  it("matches a substring inside a longer word", () => {
    expect(matchesBlockedWords("unstoppable", ["stop"])).toBe(true);
  });

  it("matches multi-word phrases contiguously", () => {
    expect(matchesBlockedWords("you are a bad person", ["bad person"])).toBe(
      true,
    );
    expect(matchesBlockedWords("bad day for a person", ["bad person"])).toBe(
      false,
    );
  });

  it("matches any entry in the list", () => {
    expect(matchesBlockedWords("hello world", ["foo", "world"])).toBe(true);
    expect(matchesBlockedWords("hello world", ["foo", "bar"])).toBe(false);
  });

  it("handles unicode content and entries", () => {
    expect(matchesBlockedWords("ang PANGIT mo", ["pangit"])).toBe(true);
    expect(matchesBlockedWords("café au lait", ["CAFÉ"])).toBe(true);
    expect(matchesBlockedWords("nice message 😊", ["😡"])).toBe(false);
  });

  it("ignores empty and whitespace-only entries", () => {
    expect(matchesBlockedWords("anything at all", ["", "   "])).toBe(false);
  });

  it("re-trims stored entries before matching", () => {
    expect(matchesBlockedWords("contains spam here", ["  spam  "])).toBe(true);
  });

  it("returns false for a null, undefined, or empty list", () => {
    expect(matchesBlockedWords("anything", null)).toBe(false);
    expect(matchesBlockedWords("anything", undefined)).toBe(false);
    expect(matchesBlockedWords("anything", [])).toBe(false);
  });
});

describe("sanitizeBlockedWords", () => {
  it("trims entries and drops empty ones", () => {
    expect(sanitizeBlockedWords(["  spam  ", "", "   ", "scam"])).toEqual([
      "spam",
      "scam",
    ]);
  });

  it("dedupes case-insensitively, keeping the first occurrence's casing", () => {
    expect(sanitizeBlockedWords(["Spam", "spam", "SPAM", "scam"])).toEqual([
      "Spam",
      "scam",
    ]);
  });

  it("drops non-string entries", () => {
    expect(sanitizeBlockedWords(["ok", 42, null, {}, ["nested"]])).toEqual([
      "ok",
    ]);
  });

  it("caps entry length", () => {
    const long = "a".repeat(MAX_BLOCKED_WORD_LENGTH + 20);
    const [entry] = sanitizeBlockedWords([long]);
    expect(entry).toHaveLength(MAX_BLOCKED_WORD_LENGTH);
  });

  it("re-trims after truncation so a capped entry can't end in whitespace", () => {
    const padded = `${"a".repeat(MAX_BLOCKED_WORD_LENGTH - 1)} b`;
    const [entry] = sanitizeBlockedWords([padded]);
    expect(entry).toBe("a".repeat(MAX_BLOCKED_WORD_LENGTH - 1));
  });

  it("caps the list size", () => {
    const input = Array.from({ length: MAX_BLOCKED_WORDS + 10 }, (_, i) =>
      String(i),
    );
    expect(sanitizeBlockedWords(input)).toHaveLength(MAX_BLOCKED_WORDS);
  });

  it("returns an empty list for non-array input", () => {
    expect(sanitizeBlockedWords(null)).toEqual([]);
    expect(sanitizeBlockedWords("spam")).toEqual([]);
    expect(sanitizeBlockedWords({ words: ["spam"] })).toEqual([]);
  });
});
