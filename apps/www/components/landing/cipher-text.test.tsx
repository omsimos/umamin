import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CipherText } from "./cipher-text";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("CipherText", () => {
  it("renders the first word on mount", () => {
    render(<CipherText words={["think.", "feel."]} />);
    expect(screen.getAllByText("think.").length).toBeGreaterThan(0);
  });

  it("decrypts into the next word after a cycle", () => {
    render(<CipherText words={["think.", "feel."]} intervalMs={1000} />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    act(() => {
      vi.advanceTimersByTime(45 * 10);
    });

    expect(screen.getAllByText("feel.").length).toBeGreaterThan(0);
  });
});
