import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ChatReceiptStats } from "../../lib/share-card/types";
import { EndedView } from "./ended-view";

// The real slot reads the viewer through React Query (Pro is ad-free).
vi.mock("@/components/ad-container-client", () => ({
  ClientOnlyAdContainer: () => null,
}));

const STATS: ChatReceiptStats = {
  matchId: "m1",
  self: { alias: "Calm Otter", avatarSeed: "s" },
  partner: { alias: "Blue Fox", avatarSeed: "p" },
  sharedInterests: [],
  messageCount: 3,
  reactionCount: 0,
  endedAt: 0,
};

describe("EndedView", () => {
  it("shows '<alias> left' when the partner left and an alias is known", () => {
    render(
      <EndedView
        reason="partner-left"
        partnerAlias="Quiet Fox"
        onFindNew={() => {}}
        onBackToLobby={() => {}}
      />,
    );
    expect(screen.getByText("Quiet Fox left")).toBeInTheDocument();
  });

  it("falls back to 'Chat ended' without a partner-left alias", () => {
    render(
      <EndedView
        reason={undefined}
        partnerAlias={undefined}
        onFindNew={() => {}}
        onBackToLobby={() => {}}
      />,
    );
    expect(screen.getByText("Chat ended")).toBeInTheDocument();
  });

  it("invokes the action callbacks", async () => {
    const onFindNew = vi.fn();
    const onBackToLobby = vi.fn();
    render(
      <EndedView
        reason="partner-left"
        partnerAlias="Fox"
        onFindNew={onFindNew}
        onBackToLobby={onBackToLobby}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /find someone new/i }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /back to lobby/i }),
    );
    expect(onFindNew).toHaveBeenCalledTimes(1);
    expect(onBackToLobby).toHaveBeenCalledTimes(1);
  });

  it("offers the share button only when receipt stats exist", () => {
    const { rerender } = render(
      <EndedView
        reason={undefined}
        partnerAlias="Fox"
        stats={null}
        onFindNew={() => {}}
        onBackToLobby={() => {}}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /share the vibe/i }),
    ).toBeNull();

    rerender(
      <EndedView
        reason={undefined}
        partnerAlias="Fox"
        stats={STATS}
        onFindNew={() => {}}
        onBackToLobby={() => {}}
      />,
    );
    expect(
      screen.getByRole("button", { name: /share the vibe/i }),
    ).toBeInTheDocument();
  });

  it("recaps the games only when a round was completed", () => {
    // Reduced motion lands the count-up digits on their final values at once.
    const matchMedia = vi
      .spyOn(window, "matchMedia")
      .mockImplementation(
        (query) => ({ matches: true, media: query }) as MediaQueryList,
      );
    const props = {
      reason: undefined,
      partnerAlias: "Fox",
      gameStreak: { current: 0, best: 3 },
      onFindNew: () => {},
      onBackToLobby: () => {},
    };
    const { rerender } = render(
      <EndedView
        {...props}
        gameTally={{ rounds: 0, matched: 0 }}
        guessTally={{ rounds: 0, correct: 0 }}
      />,
    );
    expect(screen.queryByText(/You played/)).toBeNull();

    rerender(
      <EndedView
        {...props}
        gameTally={{ rounds: 3, matched: 2 }}
        guessTally={{ rounds: 1, correct: 1 }}
      />,
    );
    expect(screen.getByText(/You played/)).toHaveTextContent(
      "You played 4 rounds together",
    );
    expect(screen.getByText(/matched/)).toHaveTextContent("2/3 matched");
    matchMedia.mockRestore();
  });
});
