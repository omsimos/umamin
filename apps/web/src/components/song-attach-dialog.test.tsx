import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { SongAttachDialog } from "./song-attach-dialog";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const LINK = "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT";

function Harness({
  onAttach,
}: {
  onAttach: (url: string) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(true);
  return (
    <SongAttachDialog
      open={open}
      onOpenChange={setOpen}
      value=""
      onAttach={onAttach}
      onRemove={() => {}}
    />
  );
}

describe("SongAttachDialog", () => {
  it("stays open with the pasted link when saving fails", async () => {
    const user = userEvent.setup();
    const onAttach = vi.fn(() => Promise.reject(new Error("Couldn't save.")));
    render(<Harness onAttach={onAttach} />);

    await user.type(screen.getByPlaceholderText("Paste a song link"), LINK);
    await user.click(screen.getByRole("button", { name: "Attach song" }));

    await waitFor(() => expect(onAttach).toHaveBeenCalledWith(LINK));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Attach song" })).toBeEnabled(),
    );
    expect(screen.getByPlaceholderText("Paste a song link")).toHaveValue(LINK);
  });

  it("closes once saving succeeds", async () => {
    const user = userEvent.setup();
    let finish: () => void = () => {};
    const onAttach = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    render(<Harness onAttach={onAttach} />);

    await user.type(screen.getByPlaceholderText("Paste a song link"), LINK);
    await user.click(screen.getByRole("button", { name: "Attach song" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    finish();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
