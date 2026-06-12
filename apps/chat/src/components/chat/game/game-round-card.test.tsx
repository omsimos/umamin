import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GAME_DECKS } from "../../../../convex/decks";
import type { GameRound } from "../../../lib/session/types";
import { GameRoundCard } from "./game-round-card";

const CARD = GAME_DECKS["this-or-that"][0]; // Coffee / Tea
const WYR = GAME_DECKS["would-you-rather"][0];

function makeRound(overrides: Partial<GameRound> = {}): GameRound {
  return {
    cardId: CARD.id,
    dealtBy: "self",
    mode: "match",
    selfPick: null,
    partnerAnswered: false,
    ...overrides,
  };
}

function renderCard(
  round: GameRound,
  handlers: Partial<{
    onAnswer: (pick: "A" | "B") => void;
    onDismiss: () => void;
    onPlayAgain: () => void;
  }> = {},
  streak = 0,
) {
  return render(
    <GameRoundCard
      round={round}
      partnerAlias="Blue Fox"
      streak={streak}
      onAnswer={handlers.onAnswer ?? (() => {})}
      onDismiss={handlers.onDismiss ?? (() => {})}
      onPlayAgain={handlers.onPlayAgain ?? (() => {})}
    />,
  );
}

describe("GameRoundCard", () => {
  it("renders both options and answers with the tapped pick", async () => {
    const onAnswer = vi.fn();
    renderCard(makeRound(), { onAnswer });
    await userEvent.click(screen.getByRole("button", { name: /Coffee/ }));
    expect(onAnswer).toHaveBeenCalledWith("A");
  });

  it("renders the prompt line for decks that have one", () => {
    renderCard(makeRound({ cardId: WYR.id }));
    expect(screen.getByText("Would you rather…")).toBeInTheDocument();
  });

  it("disables options and shows waiting state after picking", () => {
    renderCard(makeRound({ selfPick: "A" }));
    expect(screen.getByRole("button", { name: /Coffee/ })).toBeDisabled();
    expect(screen.getByText(/Waiting for Blue Fox/)).toBeInTheDocument();
  });

  it("nudges when the partner picked first", () => {
    renderCard(makeRound({ partnerAnswered: true }));
    expect(screen.getByText(/Blue Fox picked — your turn/)).toBeInTheDocument();
  });

  it("reveals a match with both chips on the same option", () => {
    renderCard(
      makeRound({ selfPick: "A", partnerAnswered: true, partnerPick: "A" }),
    );
    expect(screen.getByText("⚡ It's a match!")).toBeInTheDocument();
    const optionA = screen.getByRole("button", { name: /Coffee/ });
    expect(optionA).toHaveTextContent("You");
    expect(optionA).toHaveTextContent("Blue Fox");
  });

  it("reveals a mismatch with chips on different options", () => {
    renderCard(
      makeRound({ selfPick: "A", partnerAnswered: true, partnerPick: "B" }),
    );
    expect(screen.getByText(/Opposites attract/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tea/ })).toHaveTextContent(
      "Blue Fox",
    );
  });

  it("fires play-another and dismiss", async () => {
    const onPlayAgain = vi.fn();
    const onDismiss = vi.fn();
    renderCard(
      makeRound({ selfPick: "A", partnerAnswered: true, partnerPick: "A" }),
      { onPlayAgain, onDismiss },
    );
    await userEvent.click(screen.getByRole("button", { name: "Play another" }));
    expect(onPlayAgain).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Dismiss game" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("renders nothing for an unknown card", () => {
    const { container } = renderCard(makeRound({ cardId: "nope" }));
    expect(container).toBeEmptyDOMElement();
  });

  it("guess mode: the guesser is asked to read the dealer's mind", () => {
    renderCard(makeRound({ mode: "guess", dealtBy: "partner" }));
    expect(screen.getByText(/what did Blue Fox pick\? 🔮/)).toBeInTheDocument();
  });

  it("guess mode: the dealer is told to answer honestly", () => {
    renderCard(makeRound({ mode: "guess" }));
    expect(
      screen.getByText(/Blue Fox is guessing your pick/),
    ).toBeInTheDocument();
  });

  it("guess mode: a correct read reveals viewer-relative copy", () => {
    renderCard(
      makeRound({
        mode: "guess",
        dealtBy: "partner",
        selfPick: "A",
        partnerAnswered: true,
        partnerPick: "A",
      }),
    );
    expect(screen.getByText("🔮 You read their mind!")).toBeInTheDocument();
  });

  it("guess mode: the dealer sees who read whom", () => {
    renderCard(
      makeRound({
        mode: "guess",
        selfPick: "B",
        partnerAnswered: true,
        partnerPick: "A",
      }),
    );
    expect(screen.getByText(/Blue Fox guessed wrong/)).toBeInTheDocument();
  });

  it("shows the combo chip from two successes in a row", () => {
    renderCard(
      makeRound({ selfPick: "A", partnerAnswered: true, partnerPick: "A" }),
      {},
      2,
    );
    expect(screen.getByText("🔥×2")).toBeInTheDocument();
  });

  it("hides the combo chip on a miss and below two", () => {
    renderCard(
      makeRound({ selfPick: "A", partnerAnswered: true, partnerPick: "B" }),
      {},
      2,
    );
    expect(screen.queryByText(/🔥×/)).not.toBeInTheDocument();
  });
});
