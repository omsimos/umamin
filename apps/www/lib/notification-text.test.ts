import { describe, expect, it } from "vitest";
import { formatNotificationText } from "./notification-text";

describe("formatNotificationText", () => {
  it("names a single actor", () => {
    expect(formatNotificationText("like", 1, "Alice")).toBe(
      "Alice liked your post",
    );
    expect(formatNotificationText("comment", 1, "Alice")).toBe(
      "Alice commented on your post",
    );
    expect(formatNotificationText("follow", 1, "Alice")).toBe(
      "Alice followed you",
    );
  });

  it("aggregates extra actors as others", () => {
    expect(formatNotificationText("like", 2, "Alice")).toBe(
      "Alice and 1 other liked your post",
    );
    expect(formatNotificationText("like", 5, "Alice")).toBe(
      "Alice and 4 others liked your post",
    );
  });

  it("falls back to Someone when the actor is gone", () => {
    expect(formatNotificationText("follow", 1, null)).toBe(
      "Someone followed you",
    );
    expect(formatNotificationText("comment", 3, null)).toBe(
      "Someone and 2 others commented on your post",
    );
  });

  it("keeps messages anonymous regardless of count", () => {
    expect(formatNotificationText("message", 1, null)).toBe(
      "You received an anonymous message",
    );
    expect(formatNotificationText("message", 4, null)).toBe(
      "You received 4 anonymous messages",
    );
  });

  it("describes poll votes, aggregated like likes", () => {
    expect(formatNotificationText("vote", 1, "Alice")).toBe(
      "Alice voted on your poll",
    );
    expect(formatNotificationText("vote", 3, "Alice")).toBe(
      "Alice and 2 others voted on your poll",
    );
    expect(formatNotificationText("vote", 1, null)).toBe(
      "Someone voted on your poll",
    );
  });

  it("describes replies with the replier's name", () => {
    expect(formatNotificationText("reply", 1, "Bob")).toBe(
      "Bob replied to your message",
    );
    expect(formatNotificationText("reply", 1, null)).toBe(
      "Someone replied to your message",
    );
  });
});
