import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { REACTION_EMOJIS } from "@/lib/chat/content";
import { ReactionPicker } from "./reaction-picker";

describe("ReactionPicker", () => {
  it("calls onPick with the chosen emoji and marks the current one", async () => {
    const onPick = vi.fn();
    render(<ReactionPicker onPick={onPick} current={REACTION_EMOJIS[1]} />);
    expect(
      screen.getByRole("button", { name: `React ${REACTION_EMOJIS[1]}` }),
    ).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(
      screen.getByRole("button", { name: `React ${REACTION_EMOJIS[0]}` }),
    );
    expect(onPick).toHaveBeenCalledWith(REACTION_EMOJIS[0]);
  });
});
