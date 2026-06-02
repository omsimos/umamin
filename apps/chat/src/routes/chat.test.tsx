import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();

// The route module calls createFileRoute("/chat") at import time and useNavigate
// at render; both need the router runtime, which the unit env doesn't provide.
// Stub them so the route's own orchestration (the thing this file tests) renders.
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opts: unknown) => opts,
  useNavigate: () => navigate,
}));

import { ChatSessionProvider } from "../lib/session/chat-context";
import type { SelfIdentity } from "../lib/session/types";
import { createMockTransport } from "../lib/transport/mock-transport";
import { Session } from "./chat";

const SELF: SelfIdentity = {
  alias: "NightOwl",
  avatarSeed: "self-seed",
  interests: ["music"],
};

// Tight timings keep timer advances obvious.
const TIMINGS = {
  matchDelay: 1000,
  greetingDelay: 500,
  partnerReplyDelay: 500,
  typingDuration: 500,
  stayConnectedReplyDelay: 1000,
};

const ICE_BREAKER = /You both like|Say hi/;

// random() === 0 makes every pick deterministic for single-match tests.
function setup(random: () => number = () => 0) {
  const transport = createMockTransport({ random, timings: TIMINGS });
  render(
    <ChatSessionProvider transport={transport}>
      <Session />
    </ChatSessionProvider>,
  );
  // Synchronous transport mutation -> useSyncExternalStore re-render must be wrapped.
  const drive = (fn: () => void) => act(() => fn());
  const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
  return { transport, drive, advance };
}

function toActive(s: ReturnType<typeof setup>) {
  s.drive(() => s.transport.findMatch(SELF));
  s.advance(TIMINGS.matchDelay);
}

describe("Session route", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    navigate.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it("redirects to the lobby when there is no live session (idle)", () => {
    setup(); // transport starts idle
    expect(navigate).toHaveBeenCalledWith({ to: "/" });
  });

  it("shows the matching radar while matching and not before active", () => {
    const s = setup();
    s.drive(() => s.transport.findMatch(SELF));
    expect(screen.getByText("Finding someone for you…")).toBeInTheDocument();
    expect(screen.queryByLabelText("Message")).toBeNull();
  });

  it("routes to the active chat (header + composer) once matched", () => {
    const s = setup();
    toActive(s);
    expect(screen.queryByText("Finding someone for you…")).toBeNull();
    expect(screen.getByLabelText("Message")).toBeInTheDocument();
    expect(screen.getByLabelText("Stay connected")).toBeInTheDocument();
  });

  it("shows the ice-breaker until self sends a message, then hides it", () => {
    const s = setup();
    toActive(s);
    // Partner greeting alone must not hide the ice-breaker (self hasn't spoken).
    s.advance(TIMINGS.greetingDelay + TIMINGS.typingDuration);
    expect(screen.getByText(ICE_BREAKER)).toBeInTheDocument();

    const input = screen.getByLabelText("Message");
    s.drive(() => {
      fireEvent.change(input, { target: { value: "hello" } });
      fireEvent.submit(input);
    });
    expect(screen.queryByText(ICE_BREAKER)).toBeNull();
  });

  it("hides the ice-breaker when dismissed without sending", () => {
    const s = setup();
    toActive(s);
    s.drive(() =>
      fireEvent.click(screen.getByLabelText("Dismiss ice-breaker")),
    );
    expect(screen.queryByText(ICE_BREAKER)).toBeNull();
  });

  it("celebrates only once both sides signal stay-connected", () => {
    const s = setup();
    toActive(s);
    s.drive(() => s.transport.signalStayConnected());
    // Self-only must not celebrate yet.
    expect(screen.queryByText("It's mutual!")).toBeNull();
    s.advance(TIMINGS.stayConnectedReplyDelay);
    expect(screen.getByText("It's mutual!")).toBeInTheDocument();
  });

  it("routes to the ended overlay when the session ends", () => {
    const s = setup();
    toActive(s);
    s.drive(() => s.transport.leave("self-ended"));
    expect(screen.getByText("Chat ended")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /find someone new/i }),
    ).toBeInTheDocument();
  });

  it("resets transient UI (ice-breaker) when a new partner arrives", () => {
    // Incrementing RNG so the second match yields a different partner avatarSeed,
    // which is the key the reset effect watches.
    let n = 0;
    const s = setup(() => {
      n += 0.17;
      return n % 1;
    });
    toActive(s);
    s.drive(() =>
      fireEvent.click(screen.getByLabelText("Dismiss ice-breaker")),
    );
    expect(screen.queryByText(ICE_BREAKER)).toBeNull();

    // A fresh match (different partner) should bring the ice-breaker back.
    s.drive(() => s.transport.findMatch(SELF));
    s.advance(TIMINGS.matchDelay);
    expect(screen.getByText(ICE_BREAKER)).toBeInTheDocument();
  });
});
