import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NoteSongDrawer } from "./note-song-drawer";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { toast } from "sonner";

const TRACK = "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT";

function setClipboard(value: { readText: () => Promise<string> } | undefined) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Force the desktop (Dialog) branch — Radix is friendlier than Vaul in jsdom.
  window.matchMedia = (query: string) =>
    ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
});

function setup(value = "") {
  const onAttach = vi.fn();
  const onRemove = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <NoteSongDrawer
      open
      onOpenChange={onOpenChange}
      value={value}
      onAttach={onAttach}
      onRemove={onRemove}
    />,
  );
  return { onAttach, onRemove, onOpenChange };
}

describe("NoteSongDrawer", () => {
  it("fills the field from the clipboard and attaches a valid track", async () => {
    setClipboard({ readText: vi.fn().mockResolvedValue(TRACK) });
    const { onAttach, onOpenChange } = setup();

    const attach = screen.getByRole("button", { name: /attach song/i });
    expect(attach).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /paste/i }));

    const input = screen.getByPlaceholderText(/spotify song link/i);
    await waitFor(() => expect(input).toHaveValue(TRACK));
    expect(screen.getByText(/looks good/i)).toBeInTheDocument();
    expect(attach).toBeEnabled();

    fireEvent.click(attach);
    expect(onAttach).toHaveBeenCalledWith(TRACK);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps attach disabled for a non-Spotify clipboard value", async () => {
    setClipboard({
      readText: vi.fn().mockResolvedValue("https://example.com/song"),
    });
    setup();

    fireEvent.click(screen.getByRole("button", { name: /paste/i }));

    expect(
      await screen.findByText(/doesn't look like a spotify track/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /attach song/i })).toBeDisabled();
  });

  it("toasts when clipboard access is unavailable", async () => {
    setClipboard(undefined);
    setup();

    fireEvent.click(screen.getByRole("button", { name: /paste/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });

  it("seeds the field from an existing value and offers Remove", () => {
    setClipboard({ readText: vi.fn() });
    const { onRemove, onOpenChange } = setup(TRACK);

    expect(screen.getByPlaceholderText(/spotify song link/i)).toHaveValue(
      TRACK,
    );

    fireEvent.click(screen.getByRole("button", { name: /^remove$/i }));
    expect(onRemove).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
