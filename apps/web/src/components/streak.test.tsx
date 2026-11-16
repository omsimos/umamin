import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/query";
import { toStreakDay, toStreakMonth } from "@/lib/streak";
import { StreakReminder } from "./streak";

vi.mock("@/lib/actions", () => ({ restoreStreakAction: vi.fn() }));

const today = toStreakDay();
const month = toStreakMonth();

function setup(user: Record<string, unknown>) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(queryKeys.currentUser(), {
    user: { username: "me", ...user },
  });
  const ui = (
    <QueryClientProvider client={queryClient}>
      <StreakReminder state={user} />
    </QueryClientProvider>
  );
  return { ui };
}

describe("StreakReminder restore offer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("offers a restore the day after a missed day", () => {
    render(setup({ streak: 40, streakDay: today - 2 }).ui);
    expect(
      screen.getByText("Your 40-day streak ended yesterday."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Restore streak" }),
    ).toBeInTheDocument();
    expect(screen.getByText("3 left this month")).toBeInTheDocument();
  });

  it("offers it after a save already reset the streak today", () => {
    render(setup({ streak: 1, streakDay: today, streakBroken: 40 }).ui);
    expect(
      screen.getByRole("button", { name: "Restore streak" }),
    ).toBeInTheDocument();
  });

  it("says when the month's restores are used up", () => {
    render(
      setup({
        streak: 40,
        streakDay: today - 2,
        streakRestoresUsed: 3,
        streakRestoreMonth: month,
      }).ui,
    );
    expect(
      screen.getByText(
        "Your 40-day streak ended yesterday. You've used all 3 restores this month.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders nothing on the server, where the day isn't known", () => {
    expect(renderToString(setup({ streak: 40, streakDay: today - 2 }).ui)).toBe(
      "",
    );
  });
});
