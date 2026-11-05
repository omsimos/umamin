import { readFileSync } from "node:fs";
import { join } from "node:path";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatAnnouncement } from "@/components/chat-announcement";
import { UmaAnnouncement } from "@/components/uma-announcement";
import {
  ANNOUNCEMENT_KEYS,
  ANNOUNCEMENTS_PREPAINT_SCRIPT,
  type AnnouncementId,
} from "@/lib/announcements";
import { queryKeys } from "@/lib/query";
import type { FeatureFlagsResponse } from "@/lib/types";

// Announcements used to stay hidden until a mount effect read localStorage,
// then pop in above the feed. They now render on the server and a pre-paint
// attribute on <html> hides the dismissed ones.

const FLAGS_ON: FeatureFlagsResponse = {
  pro: false,
  contentModeration: true,
  chat: false,
  dm: false,
};

function withClient(node: ReactNode, client = new QueryClient()) {
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}

afterEach(() => {
  document.documentElement.removeAttribute("data-dismissed");
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("ChatAnnouncement", () => {
  it("is in the server HTML, tagged for the dismissal rule", () => {
    const html = renderToString(withClient(<ChatAnnouncement />));
    expect(html).toContain('data-announcement="chat"');
    expect(html).toContain("Umamin Chat is here");
  });

  it("keeps a separate id per placement", () => {
    const html = renderToString(
      withClient(<ChatAnnouncement id="chats-tab" />),
    );
    expect(html).toContain('data-announcement="chats-tab"');
  });

  it("dismissal hides every card with that id and persists", () => {
    render(withClient(<ChatAnnouncement />));
    fireEvent.click(
      screen.getByRole("button", { name: "Dismiss announcement" }),
    );

    expect(
      document.documentElement.getAttribute("data-dismissed")?.split(" "),
    ).toContain("chat");
    expect(localStorage.getItem(ANNOUNCEMENT_KEYS.chat)).toBe("1");
  });
});

describe("announcement pre-paint script", () => {
  const run = () => new Function(ANNOUNCEMENTS_PREPAINT_SCRIPT)();

  it("marks dismissed announcements on <html>", () => {
    localStorage.setItem(ANNOUNCEMENT_KEYS.chat, "1");
    localStorage.setItem(ANNOUNCEMENT_KEYS.uma, "1");
    run();
    expect(
      document.documentElement.getAttribute("data-dismissed")?.split(" "),
    ).toEqual(["chat", "uma"]);
  });

  it("leaves <html> alone when nothing was dismissed", () => {
    run();
    expect(document.documentElement.hasAttribute("data-dismissed")).toBe(false);
  });

  // Without a matching rule the attribute hides nothing and a dismissed card
  // shows again on every load.
  it("has a hiding rule in styles.css for every announcement", () => {
    const css = readFileSync(
      join(import.meta.dirname, "../src/styles.css"),
      "utf8",
    );
    for (const id of Object.keys(ANNOUNCEMENT_KEYS) as AnnouncementId[]) {
      expect(css).toContain(
        `html[data-dismissed~="${id}"] [data-announcement="${id}"]`,
      );
    }
  });
});

describe("UmaAnnouncement", () => {
  it("renders when the flag is known at mount", () => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.featureFlags(), FLAGS_ON);
    const html = renderToString(withClient(<UmaAnnouncement />, client));
    expect(html).toContain('data-announcement="uma"');
  });

  // Appearing once /api/flags answers would push the whole feed down.
  it("stays out when the flag arrives after mount", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    const client = new QueryClient();
    const { container } = render(withClient(<UmaAnnouncement />, client));
    expect(container.firstChild).toBeNull();

    act(() => {
      client.setQueryData(queryKeys.featureFlags(), FLAGS_ON);
    });
    expect(container.firstChild).toBeNull();
  });
});
