import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NotFoundPage } from "@/components/not-found-page";
import { Route } from "@/routes/__root";

// The nav shim's <Link> is TanStack Router's, which needs a RouterProvider —
// stub it to a plain <a> (same pattern as the note-card / quoted-post tests).
vi.mock("@/lib/navigation", () => ({
  // biome-ignore lint/suspicious/noExplicitAny: test stub
  Link: ({ to, href, children, ...rest }: any) => (
    <a href={to ?? href} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => "/",
  useAppNavigate: () => () => {},
}));

// The document MUST live on shellComponent: the shell wraps the root's
// component, errorComponent and notFoundComponent, so moving it back to
// `component` would make an unmatched URL / uncaught error render in place of
// <html>/<body> instead of inside it.
// `shellComponent` is accepted by createRootRouteWithContext but isn't surfaced
// on the narrowed `.options` type, so read it through a record view.
const options = Route.options as unknown as Record<string, unknown>;

describe("root route", () => {
  it("renders the document from shellComponent, not component", () => {
    expect(options.shellComponent).toBeTypeOf("function");
    expect(options.component).toBeTypeOf("function");
    expect(options.component).not.toBe(options.shellComponent);
  });

  it("owns app-wide 404 and error fallbacks", () => {
    expect(Route.options.notFoundComponent).toBeTypeOf("function");
    expect(Route.options.errorComponent).toBeTypeOf("function");
  });
});

describe("NotFoundPage", () => {
  it("renders the 404 heading", () => {
    render(<NotFoundPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: /Page Not Found/i }),
    ).toBeInTheDocument();
  });
});
