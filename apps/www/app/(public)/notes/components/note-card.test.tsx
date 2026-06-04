import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NoteItem } from "@/lib/query-types";
import { NoteCard } from "./note-card";

vi.mock("@/app/actions/note", () => ({
  addNoteReactionAction: vi.fn(),
  removeNoteReactionAction: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), loading: vi.fn() },
}));
// Severs the heavy message-action import chain; not rendered for anonymous notes.
vi.mock("./reply-drawer", () => ({ ReplyDrawer: () => null }));

import { toast } from "sonner";
import {
  addNoteReactionAction,
  removeNoteReactionAction,
} from "@/app/actions/note";

const addAction = vi.mocked(addNoteReactionAction);
const removeAction = vi.mocked(removeNoteReactionAction);

function makeNote(overrides: Partial<NoteItem> = {}): NoteItem {
  return {
    id: "note-1",
    userId: "user-1",
    content: "currently overthinking about tests",
    isAnonymous: true,
    reactionCount: 0,
    createdAt: new Date("2026-06-01T00:00:00Z"),
    updatedAt: new Date("2026-06-01T00:00:00Z"),
    ...overrides,
  };
}

function renderCard(note: NoteItem, isAuthenticated = true) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <NoteCard data={note} isAuthenticated={isAuthenticated} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("NoteCard reactions", () => {
  it("reacts optimistically and calls the add action", async () => {
    addAction.mockResolvedValue({ success: true });
    renderCard(makeNote());

    const button = screen.getByRole("button", { name: /react to this note/i });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).toHaveTextContent("0");

    fireEvent.click(button);

    await waitFor(() => {
      expect(addAction).toHaveBeenCalledWith({ noteId: "note-1" });
    });
    expect(
      screen.getByRole("button", { name: /remove reaction/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("removes a reaction and decrements the count", async () => {
    removeAction.mockResolvedValue({ success: true });
    renderCard(makeNote({ isReacted: true, reactionCount: 3 }));

    const button = screen.getByRole("button", { name: /remove reaction/i });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveTextContent("3");

    fireEvent.click(button);

    await waitFor(() => {
      expect(removeAction).toHaveBeenCalledWith({ noteId: "note-1" });
    });
    expect(
      screen.getByRole("button", { name: /react to this note/i }),
    ).toHaveTextContent("2");
  });

  it("keeps the flag but reverts the count on alreadyReacted", async () => {
    addAction.mockResolvedValue({ success: true, alreadyReacted: true });
    renderCard(makeNote({ reactionCount: 5 }));

    fireEvent.click(
      screen.getByRole("button", { name: /react to this note/i }),
    );

    await waitFor(() => {
      expect(addAction).toHaveBeenCalled();
    });
    const button = screen.getByRole("button", { name: /remove reaction/i });
    expect(button).toHaveAttribute("aria-pressed", "true");
    // No double-count: the edge already existed server-side.
    expect(button).toHaveTextContent("5");
  });

  it("rolls back and toasts when the action errors", async () => {
    addAction.mockResolvedValue({ error: "Rate limited" });
    renderCard(makeNote({ reactionCount: 2 }));

    fireEvent.click(
      screen.getByRole("button", { name: /react to this note/i }),
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Rate limited");
    });
    const button = screen.getByRole("button", { name: /react to this note/i });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).toHaveTextContent("2");
  });

  it("renders a disabled button for unauthenticated viewers", () => {
    renderCard(makeNote({ reactionCount: 7 }), false);

    const button = screen.getByRole("button", { name: /react to this note/i });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("7");

    fireEvent.click(button);
    expect(addAction).not.toHaveBeenCalled();
  });

  it("linkifies mentions and URLs in the note content", () => {
    renderCard(
      makeNote({ content: "shoutout @josh check https://example.com" }),
    );

    const mention = screen.getByRole("link", { name: "@josh" });
    expect(mention).toHaveAttribute("href", "/user/josh");
    expect(screen.getByText("https://example.com")).toBeInTheDocument();
  });
});
