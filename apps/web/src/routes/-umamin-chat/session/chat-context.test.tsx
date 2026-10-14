import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockTransport } from "../transport/mock-transport";
import { ChatSessionProvider, useChatSession } from "./chat-context";

const wsTransport = vi.hoisted(() => ({
  create: vi.fn(),
  dispose: vi.fn(),
  findMatch: vi.fn(),
}));

const toast = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

vi.mock("../transport/ws-transport", () => ({
  QUEUE_TIMEOUT_MESSAGE: "queue timed out",
  createWsTransport: (options: unknown) => {
    wsTransport.create(options);
    const mock = createMockTransport();
    return {
      ...mock,
      findMatch: (...args: Parameters<typeof mock.findMatch>) => {
        wsTransport.findMatch(...args);
        mock.findMatch(...args);
      },
      dispose: wsTransport.dispose,
    };
  },
}));

function Probe() {
  const { snapshot, findMatch } = useChatSession();
  return (
    <div>
      <span data-testid="phase">{snapshot.phase}</span>
      <button
        type="button"
        onClick={() =>
          findMatch({ alias: "NightOwl", avatarSeed: "s", interests: [] })
        }
      >
        go
      </button>
    </div>
  );
}

describe("useChatSession", () => {
  beforeEach(() => {
    wsTransport.create.mockClear();
    wsTransport.dispose.mockClear();
    wsTransport.findMatch.mockClear();
    toast.mockClear();
    toast.error.mockClear();
  });

  it("reflects the transport snapshot and drives actions", () => {
    render(
      <ChatSessionProvider transport={createMockTransport()}>
        <Probe />
      </ChatSessionProvider>,
    );
    expect(screen.getByTestId("phase").textContent).toBe("idle");
    act(() => {
      screen.getByText("go").click();
    });
    expect(screen.getByTestId("phase").textContent).toBe("matching");
  });

  // "loading" holds the session route; anything else would bounce a
  // reloading user to the lobby before the socket syncs.
  it("renders loading on the server without opening a socket", () => {
    const html = renderToString(
      <ChatSessionProvider>
        <Probe />
      </ChatSessionProvider>,
    );
    expect(html).toContain("loading");
    expect(wsTransport.create).not.toHaveBeenCalled();
  });

  it("creates the socket transport on mount and disposes it on unmount", () => {
    const { unmount } = render(
      <ChatSessionProvider>
        <Probe />
      </ChatSessionProvider>,
    );
    expect(wsTransport.create).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("phase").textContent).toBe("idle");
    unmount();
    expect(wsTransport.dispose).toHaveBeenCalledTimes(1);
  });

  it("offers to search again with the same identity after a queue timeout", () => {
    render(
      <ChatSessionProvider>
        <Probe />
      </ChatSessionProvider>,
    );
    act(() => {
      screen.getByText("go").click();
    });
    const { onError } = wsTransport.create.mock.calls[0][0] as {
      onError: (message: string) => void;
    };
    act(() => onError("queue timed out"));
    expect(toast.error).not.toHaveBeenCalled();
    const options = toast.mock.calls[0][1] as {
      action: { onClick: () => void };
    };
    act(() => options.action.onClick());
    expect(wsTransport.findMatch).toHaveBeenLastCalledWith({
      alias: "NightOwl",
      avatarSeed: "s",
      interests: [],
    });
  });

  // The composer's typing cleanup is keyed on setTyping; a new identity per
  // snapshot would send typing:off on every incoming frame.
  it("keeps action identities stable across snapshots", () => {
    const seen = new Set<unknown>();
    function Collector() {
      const { setTyping, findMatch } = useChatSession();
      seen.add(setTyping);
      return (
        <button
          type="button"
          onClick={() =>
            findMatch({ alias: "A", avatarSeed: "s", interests: [] })
          }
        >
          go
        </button>
      );
    }
    render(
      <ChatSessionProvider transport={createMockTransport()}>
        <Collector />
      </ChatSessionProvider>,
    );
    act(() => {
      screen.getByText("go").click();
    });
    expect(seen.size).toBe(1);
  });

  it("throws when used outside the provider", () => {
    function Bad() {
      useChatSession();
      return null;
    }
    expect(() => render(<Bad />)).toThrow(/ChatSessionProvider/);
  });
});
