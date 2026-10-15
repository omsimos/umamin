import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ICE_BREAKER_PROMPTS, interestById } from "@/lib/chat/content";
import { IceBreakerBanner, pickIceBreakers } from "./ice-breaker-banner";

describe("IceBreakerBanner", () => {
  it("calls onPrompt with the chip text", async () => {
    const onPrompt = vi.fn();
    render(
      <IceBreakerBanner
        sharedInterests={[]}
        onPrompt={onPrompt}
        onDismiss={() => {}}
        random={() => 0}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: ICE_BREAKER_PROMPTS[0] }),
    );
    expect(onPrompt).toHaveBeenCalledWith(ICE_BREAKER_PROMPTS[0]);
  });

  it("calls onDismiss when the dismiss button is clicked", async () => {
    const onDismiss = vi.fn();
    render(
      <IceBreakerBanner
        sharedInterests={[]}
        onPrompt={() => {}}
        onDismiss={onDismiss}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Dismiss ice-breaker" }),
    );
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("composes the shared-interest label from the interest ids", () => {
    render(
      <IceBreakerBanner
        sharedInterests={["music", "gaming"]}
        onPrompt={() => {}}
        onDismiss={() => {}}
      />,
    );
    expect(
      screen.getByText((_, el) =>
        Boolean(
          el?.getAttribute("data-slot") === "marker-content" &&
            el.textContent === "You both like 🎵 Music & 🎮 Gaming",
        ),
      ),
    ).toBeInTheDocument();
  });

  it("falls back to a greeting when there are no shared interests", () => {
    render(
      <IceBreakerBanner
        sharedInterests={[]}
        onPrompt={() => {}}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByText(/Say hi 👋/)).toBeInTheDocument();
    expect(screen.queryByText(/You both like/)).toBeNull();
  });

  it("offers a game chip only when onPlay is wired", async () => {
    const onPlay = vi.fn();
    const { unmount } = render(
      <IceBreakerBanner
        sharedInterests={[]}
        onPrompt={() => {}}
        onDismiss={() => {}}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /Play This or That/ }),
    ).toBeNull();
    unmount();

    render(
      <IceBreakerBanner
        sharedInterests={[]}
        onPrompt={() => {}}
        onPlay={onPlay}
        onDismiss={() => {}}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Play This or That/ }),
    );
    expect(onPlay).toHaveBeenCalledTimes(1);
  });
});

describe("pickIceBreakers", () => {
  it("leads with the warm-up pick, then the shared interest's opener", () => {
    const picks = pickIceBreakers(
      ["anime", "music"],
      "Coffee or Tea?",
      () => 0,
    );
    expect(picks).toEqual([
      "Coffee or Tea?",
      interestById("anime")?.opener,
      ICE_BREAKER_PROMPTS[0],
    ]);
  });

  it("fills with distinct generic prompts when nothing is shared", () => {
    const picks = pickIceBreakers([], null, () => 0.99);
    expect(picks).toHaveLength(3);
    expect(new Set(picks).size).toBe(3);
    for (const p of picks) expect(ICE_BREAKER_PROMPTS).toContain(p);
  });
});
