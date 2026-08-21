import { render, screen } from "@testing-library/react";
import { Avatar } from "@umamin/ui/components/avatar";
import { describe, expect, it } from "vitest";
import { BlobatarFallback } from "./blobatar-fallback";

// Radix's Fallback reads Avatar.Root context, so it can't render standalone.
function renderFallback(seed?: string | null) {
  return render(
    <Avatar>
      <BlobatarFallback seed={seed} />
    </Avatar>,
  );
}

const blobatar = () => screen.queryByRole("presentation", { hidden: true });

describe("BlobatarFallback", () => {
  it("renders an inline blobatar for a seeded user", () => {
    renderFallback("user_alice");

    const img = blobatar();
    expect(img).toHaveAttribute(
      "src",
      expect.stringContaining("data:image/svg+xml,"),
    );
    // Decorative: <AvatarImage> carries the alt and the avatar usually sits in
    // an aria-labelled profile link, so this must not be announced too.
    expect(img).toHaveAttribute("aria-hidden");
  });

  it("gives different users different blobatars", () => {
    const alice = renderFallback("user_alice");
    const aliceSrc = blobatar()?.getAttribute("src");
    alice.unmount();

    renderFallback("user_bob");
    expect(blobatar()?.getAttribute("src")).not.toBe(aliceSrc);
    expect(aliceSrc).toBeTruthy();
  });

  it("renders the same blobatar for a user every time", () => {
    const first = renderFallback("user_alice");
    const firstSrc = blobatar()?.getAttribute("src");
    first.unmount();

    renderFallback("user_alice");
    expect(blobatar()?.getAttribute("src")).toBe(firstSrc);
  });

  // The anonymity guard: no identity means no creature. A blobatar here would
  // link anonymous content to the same creature shown beside a real handle.
  it.each([
    null,
    undefined,
    "",
  ])("falls back to the generic icon with no seed (%s)", (seed) => {
    renderFallback(seed);
    expect(blobatar()).toBeNull();
  });
});
