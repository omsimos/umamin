import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { SelectMessage } from "@umamin/db/schema/message";
import { beforeEach, describe, expect, it, vi } from "vitest";

const openMessageAction = vi.fn();
vi.mock("@/app/actions/message", () => ({
  openMessageAction: (input: unknown) => openMessageAction(input),
}));

const vibrate = vi.fn();
vi.mock("@/lib/haptics", () => ({
  vibrate: (pattern?: unknown) => vibrate(pattern),
}));

// The menu pulls dialogs/save-image/actions — irrelevant to seal/reveal.
vi.mock("./received-card-menu", () => ({
  ReceivedMessageMenu: () => <div data-testid="menu" />,
}));

import { ReceivedMessageCard } from "./received-card";

function makeMessage(overrides: Partial<SelectMessage> = {}): SelectMessage {
  return {
    id: "msg-1",
    question: "send me a secret",
    content: "you're the reason i still use this app",
    reply: null,
    receiverId: "viewer-1",
    senderId: null,
    createdAt: new Date(),
    updatedAt: null,
    openedAt: null,
    ...overrides,
  };
}

function renderCard(data: SelectMessage) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ReceivedMessageCard data={data} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  openMessageAction.mockResolvedValue({ success: true, opened: true });
});

describe("ReceivedMessageCard", () => {
  it("conceals a sealed message behind an open button", () => {
    renderCard(makeMessage());

    expect(
      screen.getByRole("button", { name: /open anonymous message/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("send me a secret")).not.toBeInTheDocument();
    expect(screen.queryByText(/you're the reason/)).not.toBeInTheDocument();
    expect(screen.queryByTestId("menu")).not.toBeInTheDocument();
  });

  it("renders an already-opened message in full with no open button", () => {
    renderCard(makeMessage({ openedAt: new Date() }));

    expect(screen.getByText("send me a secret")).toBeInTheDocument();
    expect(screen.getByText(/you're the reason/)).toBeInTheDocument();
    expect(screen.getByTestId("menu")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /open anonymous message/i }),
    ).not.toBeInTheDocument();
  });

  it("reveals on tap, fires the action once, and buzzes", () => {
    renderCard(makeMessage());

    fireEvent.click(
      screen.getByRole("button", { name: /open anonymous message/i }),
    );

    expect(screen.getByText("send me a secret")).toBeInTheDocument();
    expect(screen.getByText(/you're the reason/)).toBeInTheDocument();
    expect(openMessageAction).toHaveBeenCalledExactlyOnceWith({
      messageId: "msg-1",
    });
    expect(vibrate).toHaveBeenCalledTimes(1);
  });
});
