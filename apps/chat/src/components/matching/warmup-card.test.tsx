import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GAME_DECKS } from "../../../convex/decks";
import { WarmupCard } from "./warmup-card";

const CARDS = GAME_DECKS["this-or-that"];

describe("WarmupCard", () => {
  it("offers a card and reports the pick as an opener prompt", async () => {
    const onPick = vi.fn();
    render(<WarmupCard onPick={onPick} />);
    const [optionA] = screen.getAllByRole("button");
    const label = optionA.textContent ?? "";
    await userEvent.click(optionA);
    expect(onPick).toHaveBeenCalledTimes(1);
    const prompt: string = onPick.mock.calls[0][0];
    expect(prompt).toContain(`(I'm team ${label})`);
    expect(
      CARDS.some((c) => prompt.startsWith(`${c.optionA} or ${c.optionB}?`)),
    ).toBe(true);
  });

  it("advances to the next card and counts picks", async () => {
    render(<WarmupCard />);
    const before = screen
      .getAllByRole("button")
      .map((b) => b.textContent)
      .join("|");
    await userEvent.click(screen.getAllByRole("button")[0]);
    const after = screen
      .getAllByRole("button")
      .map((b) => b.textContent)
      .join("|");
    expect(after).not.toBe(before);
    expect(screen.getByText(/1 picked/)).toBeInTheDocument();
  });
});
