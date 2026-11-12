import { describe, expect, it, vi } from "vitest";
import { loadAllMessages, RateLimitedError } from "./message-walk";
import type { MessagesResponse, OrgMessageItem } from "./query-types";

const noWait = async () => {};

function item(id: string): OrgMessageItem {
  return { id, question: "Q", content: id, createdAt: 0 };
}

const pages: Record<string, MessagesResponse> = {
  start: { messages: [item("a"), item("b")], nextCursor: "c1" },
  c1: { messages: [item("c"), item("d")], nextCursor: "c2" },
  c2: { messages: [item("e")], nextCursor: null },
};

function pageFor(cursor: string | null): MessagesResponse {
  const page = pages[cursor ?? "start"];
  if (!page) throw new Error(`no page for ${cursor}`);
  return page;
}

describe("loadAllMessages", () => {
  it("loads every page in order", async () => {
    const fetchPage = vi.fn(async (cursor: string | null) => pageFor(cursor));

    const all = await loadAllMessages(fetchPage, { wait: noWait });

    expect(all.map((m) => m.id)).toEqual(["a", "b", "c", "d", "e"]);
    expect(fetchPage.mock.calls.map(([c]) => c)).toEqual([null, "c1", "c2"]);
  });

  it("waits and retries the same page after a rate limit", async () => {
    let limited = false;
    const fetchPage = vi.fn(async (cursor: string | null) => {
      if (cursor === "c1" && !limited) {
        limited = true;
        throw new RateLimitedError();
      }
      return pageFor(cursor);
    });
    const onPause = vi.fn();

    const all = await loadAllMessages(fetchPage, { wait: noWait, onPause });

    expect(all.map((m) => m.id)).toEqual(["a", "b", "c", "d", "e"]);
    expect(fetchPage.mock.calls.filter(([c]) => c === "c1")).toHaveLength(2);
    expect(onPause).toHaveBeenCalledOnce();
  });

  it("gives up after the last retry", async () => {
    const fetchPage = vi.fn(async (cursor: string | null) => {
      if (cursor === "c1") throw new RateLimitedError();
      return pageFor(cursor);
    });

    await expect(
      loadAllMessages(fetchPage, { wait: noWait, maxRetries: 2 }),
    ).rejects.toBeInstanceOf(RateLimitedError);
    expect(fetchPage.mock.calls.filter(([c]) => c === "c1")).toHaveLength(3);
  });

  it("fails at once on any other error", async () => {
    const onPause = vi.fn();
    const fetchPage = vi.fn(async () => {
      throw new Error("boom");
    });

    await expect(
      loadAllMessages(fetchPage, { wait: noWait, onPause }),
    ).rejects.toThrow("boom");
    expect(fetchPage).toHaveBeenCalledOnce();
    expect(onPause).not.toHaveBeenCalled();
  });
});
