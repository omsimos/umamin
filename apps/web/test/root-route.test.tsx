import { describe, expect, it } from "vitest";
import { Route } from "@/routes/__root";

// The document MUST live on shellComponent, not component: the shell wraps the
// root's component AND its errorComponent/notFoundComponent, so moving it back
// would render an unmatched URL or an uncaught error IN PLACE of <html>/<body>
// rather than inside it. `shellComponent` is accepted by
// createRootRouteWithContext but isn't surfaced on the narrowed `.options` type.
const options = Route.options as unknown as Record<string, unknown>;

describe("root route", () => {
  it("renders the document from shellComponent, not component", () => {
    expect(options.shellComponent).toBeTypeOf("function");
    expect(options.component).not.toBe(options.shellComponent);
  });
});
