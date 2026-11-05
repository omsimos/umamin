import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RequestFailedError } from "@/lib/request-error";
import { RouteSegmentError } from "./route-segment-error";

const invalidate = vi.fn(() => Promise.resolve());
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate }),
}));

vi.mock("@/lib/navigation", () => ({
  // biome-ignore lint/suspicious/noExplicitAny: test stub
  Link: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const captureException = vi.fn();
vi.mock("@/lib/posthog", () => ({
  captureException: (error: unknown, properties?: unknown) =>
    captureException(error, properties),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("RouteSegmentError", () => {
  // reset() alone re-renders a match still in the error state, so the button
  // did nothing. Only invalidate() re-runs the loader.
  it("re-runs the route's loaders on Try Again", async () => {
    const reset = vi.fn();
    render(<RouteSegmentError error={new Error("boom")} reset={reset} />);

    await userEvent.click(screen.getByRole("button", { name: "Try Again" }));

    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it("reports a client-side failure", () => {
    const error = new RequestFailedError("/api/public/posts", 404);
    render(<RouteSegmentError error={error} />);

    expect(captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({ boundary: "route-segment" }),
    );
  });

  it("skips a 5xx the server already reported", () => {
    render(
      <RouteSegmentError
        error={new RequestFailedError("/api/public/posts", 503)}
      />,
    );

    expect(captureException).not.toHaveBeenCalled();
  });

  // An SSR loader error is serialized to the client as a plain Error.
  it("skips a 5xx that arrived from SSR as a plain Error", () => {
    render(
      <RouteSegmentError
        error={new Error("Request failed for /api/public/posts (500)")}
      />,
    );

    expect(captureException).not.toHaveBeenCalled();
  });
});
