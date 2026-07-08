import { describe, expect, it } from "vitest";
import { MAX_MESSAGE_LENGTH } from "@/lib/constants";
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
        content: "a".repeat(MAX_MESSAGE_LENGTH + 1),
      }).success,
    ).toBe(false);
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
      updateProfileSchema.safeParse({ question: "", acceptingMessages: true })
        .success,
    ).toBe(false);
  });

  it("accepts a valid profile", () => {
    expect(
      updateProfileSchema.safeParse({
        displayName: "Acme",
        question: "Ask us anything!",
        acceptingMessages: false,
      }).success,
    ).toBe(true);
  });
});
