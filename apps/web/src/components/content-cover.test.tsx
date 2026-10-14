import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/query";
import type { ContentLabel } from "@/lib/types";
import { ContentCover } from "./content-cover";

const { callAction } = vi.hoisted(() => ({
  callAction: vi.fn(async () => ({ success: true })),
}));
vi.mock("@/lib/api", () => ({ callAction }));

let keySeq = 0;

function renderCover(
  label: ContentLabel | null,
  opts: {
    isOwn?: boolean;
    isAuthenticated?: boolean;
    hideDrama?: boolean;
    revealKey?: string;
    coverDrama?: boolean;
    noun?: string;
    target?: { kind: "post" | "comment" | "note"; id: string };
  } = {},
) {
  const client = new QueryClient();
  if (opts.hideDrama !== undefined) {
    client.setQueryData(queryKeys.currentUser(), {
      user: { hideDrama: opts.hideDrama },
    });
  }
  const revealKey = opts.revealKey ?? `post:${++keySeq}`;
  const ui = (children: ReactNode) => (
    <QueryClientProvider client={client}>
      <ContentCover
        label={label}
        revealKey={revealKey}
        isOwn={opts.isOwn ?? false}
        isAuthenticated={opts.isAuthenticated ?? false}
        coverDrama={opts.coverDrama}
        noun={opts.noun}
        target={opts.target}
      >
        {children}
      </ContentCover>
    </QueryClientProvider>
  );
  return render(ui(<p>the body</p>));
}

describe("ContentCover", () => {
  it("renders unlabelled content as-is, with no provider needed", () => {
    render(
      <ContentCover label={null} revealKey="x" isOwn={false} isAuthenticated>
        <p>the body</p>
      </ContentCover>,
    );
    expect(screen.getByText("the body")).toBeVisible();
  });

  it("hides severe content from assistive tech until the viewer chooses to view it", async () => {
    renderCover("severe");
    expect(
      screen.getByText("the body").closest("[aria-hidden]"),
    ).not.toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "View" }));
    expect(screen.getByText("the body").closest("[aria-hidden]")).toBeNull();
  });

  it("moves focus to what it revealed, from the button and from the explainer", async () => {
    renderCover("drama");
    await userEvent.click(screen.getByRole("button", { name: "Show" }));
    await waitFor(() =>
      expect(screen.getByText("the body").parentElement).toHaveFocus(),
    );

    renderCover("severe");
    await userEvent.click(screen.getByRole("button", { name: "Why?" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "View post" }),
    );
    await waitFor(() =>
      expect(screen.getAllByText("the body")[1].parentElement).toHaveFocus(),
    );
  });

  it("keeps a revealed item open when it mounts again", async () => {
    const { unmount } = renderCover("severe", { revealKey: "post:kept" });
    await userEvent.click(screen.getByRole("button", { name: "View" }));
    unmount();

    renderCover("severe", { revealKey: "post:kept" });
    expect(screen.queryByRole("button", { name: "View" })).toBeNull();
  });

  it("folds drama for logged-out viewers and for viewers who hide it", async () => {
    renderCover("drama");
    expect(screen.queryByText("the body")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(screen.getByText("the body")).toBeVisible();
  });

  it("shows drama in full to a viewer who turned the setting off", () => {
    renderCover("drama", { isAuthenticated: true, hideDrama: false });
    expect(screen.getByText("the body")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Show" })).toBeNull();
  });

  it("never covers the author's own content, but tells them", () => {
    renderCover("severe", { isOwn: true, isAuthenticated: true });
    expect(screen.getByText("the body").closest("[aria-hidden]")).toBeNull();
    expect(screen.getByText("Others see this post covered.")).toBeVisible();
  });

  it("lets the author ask for review of their own covered post, once", async () => {
    callAction.mockClear();
    renderCover("severe", {
      isOwn: true,
      isAuthenticated: true,
      target: { kind: "post", id: "p1" },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Ask for review" }),
    );
    expect(callAction).toHaveBeenCalledWith("appealContentLabelAction", {
      kind: "post",
      id: "p1",
    });
    expect(await screen.findByText("Sent for review.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Ask for review" })).toBeNull();
  });

  it("lets a signed-in viewer tell a moderator Uma got it wrong", async () => {
    callAction.mockClear();
    renderCover("drama", {
      isAuthenticated: true,
      hideDrama: true,
      target: { kind: "comment", id: "c1" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Why?" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Uma got this wrong" }),
    );
    expect(callAction).toHaveBeenCalledWith("disputeContentLabelAction", {
      kind: "comment",
      id: "c1",
    });
    expect(
      await screen.findByText("Thanks. A moderator will take a look."),
    ).toBeVisible();
  });

  it("offers no review request without an account or for private messages", async () => {
    renderCover("severe", { target: { kind: "post", id: "p2" } });
    await userEvent.click(screen.getByRole("button", { name: "Why?" }));
    await screen.findByRole("heading", { name: "Why is this covered?" });
    expect(
      screen.queryByRole("button", { name: "Uma got this wrong" }),
    ).toBeNull();
  });

  it("explains a fold and reveals it from the explainer", async () => {
    renderCover("drama");
    await userEvent.click(screen.getByRole("button", { name: "Why?" }));
    expect(
      await screen.findByRole("heading", { name: "Why is this folded?" }),
    ).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Show post" }));
    expect(screen.getByText("the body")).toBeVisible();
  });

  it("only promises moderator review where the queue covers it", async () => {
    renderCover("severe");
    await userEvent.click(screen.getByRole("button", { name: "Why?" }));
    expect(await screen.findByText(/Moderators review posts/)).toBeVisible();
  });

  it("never sends a filtered message's reader to moderators", async () => {
    renderCover("drama", { coverDrama: true, noun: "message" });
    await userEvent.click(screen.getByRole("button", { name: "Why?" }));
    expect(
      await screen.findByText(/You turned on Filter hurtful messages/),
    ).toBeVisible();
    expect(screen.queryByText(/Moderators/)).toBeNull();
  });
});
