import { act } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captureException = vi.fn();
vi.mock("@/lib/posthog", () => ({
  captureException: (error: unknown, properties?: Record<string, unknown>) =>
    captureException(error, properties),
}));
vi.mock("@/lib/early-errors", () => ({
  whenIdle: (task: () => void) => task(),
}));

const { reportRecoverableError } = await import("@/lib/recoverable-error");

function ProfileBadge({ server }: { server: boolean }) {
  return server ? <span>badge</span> : <a href="/badge">badge</a>;
}

function Page({ server }: { server: boolean }) {
  return (
    <main>
      <ProfileBadge server={server} />
    </main>
  );
}

let container: HTMLDivElement;

beforeEach(() => {
  captureException.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  vi.restoreAllMocks();
  container.remove();
  for (const el of document.querySelectorAll("font")) el.remove();
});

async function hydrateMismatch() {
  container.innerHTML = renderToString(<Page server />);
  await act(async () => {
    hydrateRoot(container, <Page server={false} />, {
      onRecoverableError: reportRecoverableError,
    });
  });
}

// A production #418 names neither the component nor the markup. The
// component stack from errorInfo is the only pointer to where it happened.
describe("reportRecoverableError", () => {
  it("reports a hydration mismatch with the component that caused it", async () => {
    await hydrateMismatch();

    expect(captureException).toHaveBeenCalledTimes(1);
    const [error, context] = captureException.mock.calls[0] ?? [];
    expect(context).toMatchObject({
      source: "recoverable",
      componentStack: expect.stringContaining("ProfileBadge"),
    });
    // As the cause, the stack is symbolicated against the source maps.
    expect((error as Error).cause).toMatchObject({
      name: "ComponentStack",
      stack: expect.stringContaining("ProfileBadge"),
    });
  });

  it("records whether the page was translated before hydration", async () => {
    document.body.appendChild(document.createElement("font"));
    await hydrateMismatch();

    expect(captureException.mock.calls[0]?.[1]).toMatchObject({
      translated: true,
      adsScriptLoaded: false,
    });
  });
});
