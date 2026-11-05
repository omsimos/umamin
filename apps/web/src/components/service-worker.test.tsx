import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceWorker } from "./service-worker";

vi.mock("sonner", () => ({ toast: vi.fn() }));

const GUARD_KEY = "umamin:chunk-reload";

function firePreloadError() {
  const event = new Event("vite:preloadError", { cancelable: true });
  window.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  sessionStorage.clear();
  // jsdom can't navigate; it reports location.reload() as not implemented.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("ServiceWorker chunk preload errors", () => {
  // A prevented event makes Vite resolve the dynamic import to undefined, and
  // lazyRouteComponent then throws reading `default` off it.
  it("lets the import error propagate", () => {
    render(<ServiceWorker />);

    expect(firePreloadError().defaultPrevented).toBe(false);
    expect(sessionStorage.getItem(GUARD_KEY)).not.toBeNull();
  });

  it("still lets the error through inside the reload guard window", () => {
    const recent = String(Date.now() - 5_000);
    sessionStorage.setItem(GUARD_KEY, recent);
    render(<ServiceWorker />);

    expect(firePreloadError().defaultPrevented).toBe(false);
    expect(sessionStorage.getItem(GUARD_KEY)).toBe(recent);
  });
});
