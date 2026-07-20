import { describe, expect, it } from "vitest";
import {
  DEFAULT_MESSAGE_CHAR_LIMIT,
  MAX_MESSAGE_CHAR_LIMIT,
  MIN_MESSAGE_CHAR_LIMIT,
  resolveMessageCharLimit,
} from "@/lib/constants";
import {
  passwordFormSchema,
  sendMessageSchema,
  updateProfileSchema,
} from "@/lib/schema";

describe("sendMessageSchema", () => {
  it("rejects empty / whitespace content", () => {
    expect(
      sendMessageSchema.safeParse({ orgId: "x", content: "   " }).success,
    ).toBe(false);
  });

  it("rejects content over the max length", () => {
    expect(
      sendMessageSchema.safeParse({
        orgId: "x",
        content: "a".repeat(MAX_MESSAGE_CHAR_LIMIT + 1),
      }).success,
    ).toBe(false);
  });

  it("accepts content at the hard platform ceiling", () => {
    expect(
      sendMessageSchema.safeParse({
        orgId: "x",
        content: "a".repeat(MAX_MESSAGE_CHAR_LIMIT),
      }).success,
    ).toBe(true);
  });

  it("requires an orgId", () => {
    expect(
      sendMessageSchema.safeParse({ orgId: "", content: "hi" }).success,
    ).toBe(false);
  });

  it("accepts valid input and trims content", () => {
    const res = sendMessageSchema.safeParse({ orgId: "x", content: "  hi  " });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.content).toBe("hi");
  });
});

describe("passwordFormSchema", () => {
  it("rejects mismatched confirmation", () => {
    expect(
      passwordFormSchema.safeParse({
        currentPassword: "x",
        newPassword: "abcabcabc1",
        confirmPassword: "different00",
      }).success,
    ).toBe(false);
  });

  it("rejects a too-short new password", () => {
    expect(
      passwordFormSchema.safeParse({
        currentPassword: "x",
        newPassword: "short",
        confirmPassword: "short",
      }).success,
    ).toBe(false);
  });

  it("accepts a matching valid password", () => {
    expect(
      passwordFormSchema.safeParse({
        currentPassword: "x",
        newPassword: "abcabcabc1",
        confirmPassword: "abcabcabc1",
      }).success,
    ).toBe(true);
  });
});

describe("updateProfileSchema", () => {
  it("rejects an empty prompt", () => {
    expect(
      updateProfileSchema.safeParse({
        question: "",
        acceptingMessages: true,
        messageCharLimit: null,
      }).success,
    ).toBe(false);
  });

  it("accepts a valid profile", () => {
    expect(
      updateProfileSchema.safeParse({
        displayName: "Acme",
        question: "Ask us anything!",
        acceptingMessages: false,
        messageCharLimit: null,
      }).success,
    ).toBe(true);
  });

  it.each([
    null,
    MIN_MESSAGE_CHAR_LIMIT,
    DEFAULT_MESSAGE_CHAR_LIMIT,
    MAX_MESSAGE_CHAR_LIMIT,
  ])("accepts message character limit %s", (messageCharLimit) => {
    expect(
      updateProfileSchema.safeParse({
        question: "Ask us anything!",
        acceptingMessages: true,
        messageCharLimit,
      }).success,
    ).toBe(true);
  });

  it.each([
    MIN_MESSAGE_CHAR_LIMIT - 1,
    MAX_MESSAGE_CHAR_LIMIT + 1,
    100.5,
  ])("rejects invalid message character limit %s", (messageCharLimit) => {
    expect(
      updateProfileSchema.safeParse({
        question: "Ask us anything!",
        acceptingMessages: true,
        messageCharLimit,
      }).success,
    ).toBe(false);
  });
});

describe("resolveMessageCharLimit", () => {
  it("uses the default only when the override is unset", () => {
    expect(resolveMessageCharLimit(null)).toBe(DEFAULT_MESSAGE_CHAR_LIMIT);
    expect(resolveMessageCharLimit(undefined)).toBe(DEFAULT_MESSAGE_CHAR_LIMIT);
    expect(resolveMessageCharLimit(250)).toBe(250);
  });
});
