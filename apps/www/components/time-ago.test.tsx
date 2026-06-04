import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimeAgo } from "./time-ago";

// Anchor the clock so relative labels are deterministic across runs/timezones.
const NOW = new Date("2026-06-04T12:00:00.000Z");

describe("TimeAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a machine-readable <time> with an ISO dateTime", () => {
    const date = new Date("2026-06-04T11:55:00.000Z");
    render(<TimeAgo date={date} />);

    const el = screen.getByText("5m");
    expect(el.tagName).toBe("TIME");
    expect(el).toHaveAttribute("dateTime", "2026-06-04T11:55:00.000Z");
  });

  it("collapses sub-minute deltas to 'just now'", () => {
    render(<TimeAgo date={new Date("2026-06-04T11:59:45.000Z")} />);
    expect(screen.getByText("just now")).toBeInTheDocument();
  });

  it("renders short hour and day labels", () => {
    const { rerender } = render(
      <TimeAgo date={new Date("2026-06-04T09:00:00.000Z")} />,
    );
    expect(screen.getByText("3h")).toBeInTheDocument();

    rerender(<TimeAgo date={new Date("2026-06-02T12:00:00.000Z")} />);
    expect(screen.getByText("2d")).toBeInTheDocument();
  });

  it("accepts ISO strings as well as Date objects", () => {
    render(<TimeAgo date="2026-06-04T11:55:00.000Z" />);
    const el = screen.getByText("5m");
    expect(el).toHaveAttribute("dateTime", "2026-06-04T11:55:00.000Z");
  });

  it("exposes the exact time in the title for hover, distinct from the label", () => {
    render(<TimeAgo date={new Date("2026-06-04T11:55:00.000Z")} />);
    const el = screen.getByText("5m");
    const title = el.getAttribute("title");
    expect(title).toBeTruthy();
    expect(title).not.toBe("5m");
  });

  it("forwards className to the <time> element", () => {
    render(
      <TimeAgo date={new Date("2026-06-04T11:55:00.000Z")} className="muted" />,
    );
    expect(screen.getByText("5m")).toHaveClass("muted");
  });

  it("renders nothing for an invalid date instead of throwing", () => {
    const { container } = render(<TimeAgo date="not-a-date" />);
    // Guards against d.toISOString() throwing on an Invalid Date.
    expect(container).toBeEmptyDOMElement();
  });
});
