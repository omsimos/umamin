import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { MessageReaction } from "../../lib/session/types";
import { ReactionDetails } from "./reaction-details";

const SELF = { alias: "Calm Otter", avatarSeed: "self-seed" };
const PARTNER = { alias: "Blue Fox", avatarSeed: "partner-seed" };
const REACTIONS: MessageReaction[] = [
  { emoji: "❤️", by: "self" },
  { emoji: "❤️", by: "partner" },
];

const originalMatchMedia = window.matchMedia;

function stubViewport(desktop: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: desktop,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

function renderDetails() {
  return render(
    <ReactionDetails
      open
      onOpenChange={() => {}}
      reactions={REACTIONS}
      self={SELF}
      partner={PARTNER}
    />,
  );
}

describe("ReactionDetails", () => {
  it("renders as a bottom drawer on mobile and lists every reactor", () => {
    stubViewport(false);
    renderDetails();

    expect(
      document.querySelector('[data-slot="drawer-content"]'),
    ).not.toBeNull();
    expect(document.querySelector('[data-slot="dialog-content"]')).toBeNull();

    const details = screen.getByRole("dialog");
    expect(details).toHaveTextContent("Calm Otter");
    expect(details).toHaveTextContent("(you)");
    expect(details).toHaveTextContent("Blue Fox");
    expect(screen.getAllByText("❤️")).toHaveLength(2);
  });

  it("renders as a dialog on desktop", () => {
    stubViewport(true);
    renderDetails();

    expect(
      document.querySelector('[data-slot="dialog-content"]'),
    ).not.toBeNull();
    expect(document.querySelector('[data-slot="drawer-content"]')).toBeNull();
    expect(screen.getByRole("dialog")).toHaveTextContent("Blue Fox");
  });
});
