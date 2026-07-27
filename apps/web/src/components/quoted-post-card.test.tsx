import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { QuotedPostData } from "@/lib/types";
import { QuotedPostCard } from "./quoted-post-card";

// The card links via the @/lib/navigation shim's <Link>, which is TanStack
// Router's Link and needs a RouterProvider. Mock the shim to a plain <a> so the
// card renders standalone (href === the `to` target).
vi.mock("@/lib/navigation", () => ({
  // biome-ignore lint/suspicious/noExplicitAny: test stub
  Link: ({ to, href, children, prefetch: _p, preload: _pl, ...rest }: any) => (
    <a href={to ?? href} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => "/",
  useAppNavigate: () => () => {},
}));

const author = {
  id: "user_1",
  username: "alice",
  displayName: "Alice",
  imageUrl: null,
  quietMode: false,
  equippedGroupId: null,
  points: 0,
  createdAt: new Date("2024-01-01"),
} as QuotedPostData["author"];

function makeQuoted(overrides: Partial<QuotedPostData> = {}): QuotedPostData {
  return {
    id: "post_1",
    content: "the original post",
    images: null,
    quotedPostId: null,
    authorId: author.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    likeCount: 0,
    commentCount: 0,
    repostCount: 0,
    pollVoteCount: 0,
    pollEndsAt: null,
    author,
    ...overrides,
  };
}

describe("QuotedPostCard", () => {
  it("links the whole card to the quoted post", () => {
    render(<QuotedPostCard post={makeQuoted()} />);

    const link = screen.getByRole("link", {
      name: /view quoted post by @alice/i,
    });
    expect(link).toHaveAttribute("href", "/post/post_1");
    expect(screen.getByText("the original post")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("@alice")).toBeInTheDocument();
  });

  it("falls back to the username when no display name is set", () => {
    render(
      <QuotedPostCard
        post={makeQuoted({ author: { ...author, displayName: null } })}
      />,
    );
    expect(screen.getAllByText(/alice/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link")).toBeInTheDocument();
  });

  it("renders a non-linked preview for the composer", () => {
    render(<QuotedPostCard post={makeQuoted()} linked={false} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("the original post")).toBeInTheDocument();
  });

  it("renders the unavailable husk for a deleted/hidden post", () => {
    render(<QuotedPostCard post={null} />);
    expect(screen.getByText("This post is unavailable.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
