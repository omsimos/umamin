import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { streakDay } from "@/lib/streak";
import type { PublicUserWithBadge } from "@/lib/types";
import { UserCard } from "./user-card";

vi.mock("@/lib/navigation", () => ({
  // biome-ignore lint/suspicious/noExplicitAny: test stub
  Link: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("./copy-link", () => ({ default: () => null }));
vi.mock("./follow-list-drawer", () => ({ FollowListDrawer: () => null }));
vi.mock("./share-button", () => ({ ProfileShareMenu: () => null }));

const user: PublicUserWithBadge = {
  id: "u1",
  username: "alice",
  displayName: null,
  imageUrl: null,
  bio: null,
  question: "Ask me anything",
  quietMode: false,
  pinnedPostId: null,
  equippedGroupId: null,
  followerCount: 0,
  followingCount: 0,
  points: 0,
  proUntil: null,
  noteStreak: 0,
  noteStreakDay: null,
  createdAt: new Date("2026-06-01T00:00:00Z"),
  updatedAt: new Date("2026-06-01T00:00:00Z"),
};

describe("UserCard note streak", () => {
  it("shows a live streak", () => {
    render(
      <UserCard
        user={{ ...user, noteStreak: 12, noteStreakDay: streakDay() - 1 }}
      />,
    );
    expect(screen.getByText("-day note streak")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("hides a streak that broke after the profile was cached", () => {
    render(
      <UserCard
        user={{ ...user, noteStreak: 12, noteStreakDay: streakDay() - 2 }}
      />,
    );
    expect(screen.getByText("aura points")).toBeInTheDocument();
    expect(screen.queryByText("-day note streak")).toBeNull();
  });

  it("hides a 1-day streak", () => {
    render(
      <UserCard
        user={{ ...user, noteStreak: 1, noteStreakDay: streakDay() }}
      />,
    );
    expect(screen.queryByText("-day note streak")).toBeNull();
  });

  it("leaves a live streak out of the server render", () => {
    // The server and device clocks can disagree on the day, so the streak
    // only renders after hydration.
    const html = renderToString(
      <UserCard
        user={{ ...user, noteStreak: 12, noteStreakDay: streakDay() }}
      />,
    );
    expect(html).toContain("aura points");
    expect(html).not.toContain("note streak");
  });
});
