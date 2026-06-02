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
