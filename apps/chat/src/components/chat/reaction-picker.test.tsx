import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { REACTION_EMOJIS } from "../../lib/content";
import { ReactionPicker } from "./reaction-picker";

describe("ReactionPicker", () => {
  it("renders a button for every reaction emoji", () => {
    render(<ReactionPicker onPick={() => {}} />);
    expect(screen.getAllByRole("button")).toHaveLength(REACTION_EMOJIS.length);
  });

  it("calls onPick with the chosen emoji", async () => {
    const onPick = vi.fn();
    render(<ReactionPicker onPick={onPick} />);
    await userEvent.click(
      screen.getByRole("button", { name: `React ${REACTION_EMOJIS[0]}` }),
    );
    expect(onPick).toHaveBeenCalledWith(REACTION_EMOJIS[0]);
  });
});
