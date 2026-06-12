import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { REACTION_MIN_LEVEL } from "../../../convex/constants";
import { REACTION_EMOJIS } from "../../lib/content";
import { ReactionPicker } from "./reaction-picker";

const BASE = REACTION_EMOJIS.filter((e) => (REACTION_MIN_LEVEL[e] ?? 1) === 1);

describe("ReactionPicker", () => {
  it("renders only ungated emojis at level 1", () => {
    render(<ReactionPicker onPick={() => {}} />);
    expect(screen.getAllByRole("button")).toHaveLength(BASE.length);
    expect(screen.queryByRole("button", { name: "React 🫶" })).toBeNull();
  });

  it("renders every emoji once the vibe unlocks them", () => {
    render(<ReactionPicker onPick={() => {}} vibeLevel={3} />);
    expect(screen.getAllByRole("button")).toHaveLength(REACTION_EMOJIS.length);
    expect(
      screen.getByRole("button", { name: "React 🫶" }),
    ).toBeInTheDocument();
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
