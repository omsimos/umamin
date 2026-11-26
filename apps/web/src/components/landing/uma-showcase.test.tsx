import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { UmaShowcase } from "./uma-showcase";

const DISPUTE = /talk about you in the gc/;

describe("UmaShowcase", () => {
  it("folds the dispute again when Hide disputes is turned back on", async () => {
    const user = userEvent.setup();
    render(<UmaShowcase />);
    expect(screen.queryByText(DISPUTE)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show" }));
    expect(screen.getByText(DISPUTE)).toBeInTheDocument();

    const toggle = screen.getByRole("switch", { name: /Hide disputes/ });
    await user.click(toggle);
    expect(screen.getByText(DISPUTE)).toBeInTheDocument();

    await user.click(toggle);
    expect(screen.queryByText(DISPUTE)).not.toBeInTheDocument();
  });

  it("turns Uma serious after the severe post is opened", async () => {
    const user = userEvent.setup();
    const { container } = render(<UmaShowcase />);
    const speaker = () => container.querySelector("svg[data-mood]");
    expect(speaker()).toHaveAttribute("data-mood", "calm");

    await user.click(screen.getByRole("button", { name: "View" }));
    expect(speaker()).toHaveAttribute("data-mood", "serious");
  });
});
