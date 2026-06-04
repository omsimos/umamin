import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DemoMessage } from "./demo-message";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("DemoMessage", () => {
  it("shows a sent message as ciphertext, then decrypts it", () => {
    render(<DemoMessage />);

    fireEvent.change(screen.getByLabelText("Anonymous message"), {
      target: { value: "hello there" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /send anonymous message/i }),
    );

    expect(screen.queryByText("hello there")).not.toBeInTheDocument();
    expect(screen.getByText("encrypting…")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    expect(screen.getByText("hello there")).toBeInTheDocument();
    expect(screen.getByText(/AES-256 · delivered/)).toBeInTheDocument();
  });

  it("sends a suggestion chip as a message", () => {
    render(<DemoMessage />);

    fireEvent.click(screen.getByRole("button", { name: "spill a secret" }));
    act(() => {
      vi.advanceTimersByTime(1300);
    });

    // The chip label plus the decrypted bubble.
    expect(screen.getAllByText("spill a secret")).toHaveLength(2);
  });
});
