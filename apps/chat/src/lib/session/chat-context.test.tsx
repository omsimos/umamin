import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChatSessionProvider, useChatSession } from "./chat-context";

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
  it("reflects the transport snapshot and drives actions", () => {
    render(
      <ChatSessionProvider>
        <Probe />
      </ChatSessionProvider>,
    );
    expect(screen.getByTestId("phase").textContent).toBe("idle");
    act(() => {
      screen.getByText("go").click();
    });
    expect(screen.getByTestId("phase").textContent).toBe("matching");
  });

  it("throws when used outside the provider", () => {
    function Bad() {
      useChatSession();
      return null;
    }
    expect(() => render(<Bad />)).toThrow(/ChatSessionProvider/);
  });
});
