import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PostImageDisplay } from "@/types/post";
import { PostImages } from "./post-images";

function makeImages(count: number): PostImageDisplay[] {
  return Array.from({ length: count }, (_, i) => ({
    key: `posts/user_1/img${i}.webp`,
    width: 1200,
    height: 900,
  }));
}

function renderedImgs(container: HTMLElement) {
  return Array.from(container.querySelectorAll("img"));
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_URL", "https://media.example.com");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("PostImages", () => {
  it("renders one lazy tile per image with the public URL", () => {
    const { container } = render(<PostImages images={makeImages(3)} />);

    const tiles = screen.getAllByRole("button");
    expect(tiles).toHaveLength(3);

    const [img] = renderedImgs(container);
    expect(img.getAttribute("src")).toBe(
      "https://media.example.com/posts/user_1/img0.webp",
    );
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("width", "1200");
    expect(img).toHaveAttribute("height", "900");
  });

  it("prefers the optimistic preview URL over the remote URL", () => {
    const images = makeImages(1);
    images[0].previewUrl = "blob:local-preview";

    const { container } = render(<PostImages images={images} />);
    expect(renderedImgs(container)[0].getAttribute("src")).toBe(
      "blob:local-preview",
    );
  });

  it("caps rendering at four images", () => {
    render(<PostImages images={makeImages(6)} />);
    expect(screen.getAllByRole("button")).toHaveLength(4);
  });

  it("opens the lightbox at the clicked image with a counter", async () => {
    const user = userEvent.setup();
    render(<PostImages images={makeImages(3)} />);

    await user.click(
      screen.getByRole("button", { name: /view image 2 of 3/i }),
    );

    expect(await screen.findByText("Image viewer")).toBeInTheDocument();
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("renders an empty fragment for no images", () => {
    const { container } = render(<PostImages images={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
