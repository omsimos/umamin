// Extends Vitest's `expect` with jest-dom matchers (toBeInTheDocument, etc.)
// and registers the module augmentation project-wide for tests.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// With `globals: false`, RTL can't auto-register its afterEach(cleanup), so
// rendered DOM would leak across tests. Register it here.
afterEach(cleanup);
