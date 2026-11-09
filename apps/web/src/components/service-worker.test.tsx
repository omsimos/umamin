import { render, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reloadPage } from "@/lib/reload-page";
import { ServiceWorker } from "./service-worker";

vi.mock("sonner", () => ({ toast: vi.fn() }));
vi.mock("@/lib/reload-page", () => ({ reloadPage: vi.fn() }));

const GUARD_KEY = "umamin:chunk-reload";

function firePreloadError() {
  const event = new Event("vite:preloadError", { cancelable: true });
  window.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  sessionStorage.clear();
  vi.mocked(toast).mockClear();
  vi.mocked(reloadPage).mockClear();
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

type ToastOptions = {
  action: { onClick: () => void };
  onDismiss?: () => void;
  onAutoClose?: () => void;
};

class FakeWorker extends EventTarget {
  state = "installed";
  postMessage = vi.fn();
}

// One tab's view of the service worker: the container, and a registration
// with an update already installed and waiting.
function installServiceWorker({ controlled = true, waiting = true } = {}) {
  const worker = new FakeWorker();
  const registration = Object.assign(new EventTarget(), {
    waiting: waiting ? worker : null,
    installing: null,
  });
  const container = Object.assign(new EventTarget(), {
    controller: controlled ? {} : null,
    register: vi.fn(async () => registration),
  });
  Object.defineProperty(navigator, "serviceWorker", {
    value: container,
    configurable: true,
  });
  const controllerChange = () =>
    container.dispatchEvent(new Event("controllerchange"));
  return { worker, registration, container, controllerChange };
}

function lastToast(): ToastOptions {
  const calls = vi.mocked(toast).mock.calls;
  return calls[calls.length - 1][1] as unknown as ToastOptions;
}

describe("ServiceWorker update offer", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "serviceWorker");
  });

  it("re-offers a working reload when another tab activates the update", async () => {
    const sw = installServiceWorker();
    render(<ServiceWorker />);
    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));

    // Tab B clicked Reload: the new worker now controls this tab too, and its
    // activate step purged the caches this tab was loaded from.
    sw.registration.waiting = null;
    sw.controllerChange();

    expect(toast).toHaveBeenCalledTimes(2);
    lastToast().action.onClick();
    expect(reloadPage).toHaveBeenCalledTimes(1);
  });

  it("reloads this tab once after its own Reload activates the update", async () => {
    const sw = installServiceWorker();
    render(<ServiceWorker />);
    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));

    lastToast().action.onClick();
    expect(sw.worker.postMessage).toHaveBeenCalledWith({
      type: "SKIP_WAITING",
    });
    expect(reloadPage).not.toHaveBeenCalled();

    sw.controllerChange();
    sw.controllerChange();
    expect(reloadPage).toHaveBeenCalledTimes(1);
  });

  it("offers again after a dismissed toast once the tab is visible", async () => {
    installServiceWorker();
    render(<ServiceWorker />);
    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));

    lastToast().onAutoClose?.();
    document.dispatchEvent(new Event("visibilitychange"));

    expect(toast).toHaveBeenCalledTimes(2);
  });

  it("doesn't reload again right after an update reload", async () => {
    sessionStorage.setItem("umamin:sw-update-reload", String(Date.now()));
    const sw = installServiceWorker();
    render(<ServiceWorker />);
    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));

    lastToast().action.onClick();
    sw.controllerChange();

    expect(reloadPage).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledTimes(2);
  });

  it("ignores the first install taking control of a fresh visit", async () => {
    const sw = installServiceWorker({ controlled: false, waiting: false });
    render(<ServiceWorker />);
    await waitFor(() => expect(sw.container.register).toHaveBeenCalled());

    sw.controllerChange();

    expect(toast).not.toHaveBeenCalled();
    expect(reloadPage).not.toHaveBeenCalled();
  });
});
