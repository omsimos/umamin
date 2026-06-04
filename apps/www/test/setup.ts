// Extends Vitest's `expect` with jest-dom matchers (toBeInTheDocument, etc.)
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// With `globals: false`, RTL can't auto-register its afterEach(cleanup), so
// rendered DOM would leak across tests. Register it here.
afterEach(cleanup);

// jsdom has no layout engine, so scrollIntoView is undefined.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom has no ResizeObserver; Radix positioning observes its trigger/content.
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
