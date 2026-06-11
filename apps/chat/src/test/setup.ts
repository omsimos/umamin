// Extends Vitest's `expect` with jest-dom matchers (toBeInTheDocument, etc.)
// and registers the module augmentation project-wide for tests.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// With `globals: false`, RTL can't auto-register its afterEach(cleanup), so
// rendered DOM would leak across tests. Register it here.
afterEach(cleanup);

// jsdom has no layout engine, so scrollIntoView is undefined; components that
// auto-scroll to a new message would throw on mount without this stub.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom has no ResizeObserver; Radix Popover's positioning (Floating UI
// autoUpdate) observes the trigger/content on open.
if (!("ResizeObserver" in globalThis)) {
  class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // biome-ignore lint/suspicious/noExplicitAny: test stub
  (globalThis as any).ResizeObserver = MockResizeObserver;
}

// jsdom lacks the Pointer Capture API that Radix's dismissable layer touches.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}

// jsdom has no matchMedia; useMediaQuery (dialog-vs-drawer split) reads it.
// Defaults to no-match (mobile) — tests override per-case for the desktop path.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// jsdom has no URL.createObjectURL; the share-card download/preview path
// builds object URLs for generated blobs.
if (typeof URL.createObjectURL !== "function") {
  URL.createObjectURL = () => "blob:mock";
  URL.revokeObjectURL = () => {};
}

// jsdom has no IntersectionObserver; lazy AdContainer constructs one on mount.
if (!("IntersectionObserver" in globalThis)) {
  class MockIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  // biome-ignore lint/suspicious/noExplicitAny: test stub
  (globalThis as any).IntersectionObserver = MockIntersectionObserver;
}
