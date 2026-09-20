import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { beforeEach, describe, expect, it, vi } from "vitest";

// public/sw.js runs in a worker global, so it is evaluated here inside a vm
// context with a hand-rolled `self` / `caches` / `fetch`. Requests and
// responses are plain objects: the worker only reads method / url / mode /
// destination and ok / type / clone(), and Node's Request rejects
// mode:"navigate" outright.
const SW_SOURCE = readFileSync(
  join(import.meta.dirname, "../public/sw.js"),
  "utf8",
);
const ORIGIN = "https://www.umamin.link";

type Listener = (event: Record<string, unknown>) => unknown;

type FakeResponse = { ok: boolean; type: string; clone: () => FakeResponse };

function response(ok = true, type = "basic"): FakeResponse {
  const r: FakeResponse = { ok, type, clone: () => r };
  return r;
}

function request(
  path: string,
  init: { mode?: string; destination?: string; method?: string } = {},
) {
  return {
    method: init.method ?? "GET",
    url: new URL(path, ORIGIN).href,
    mode: init.mode ?? "no-cors",
    destination: init.destination ?? "",
  };
}

function makeWorker() {
  const listeners = new Map<string, Listener[]>();
  const stores = new Map<string, Map<string, FakeResponse>>();
  const keyOf = (req: unknown) =>
    typeof req === "string"
      ? new URL(req, ORIGIN).href
      : (req as { url: string }).url;

  const cacheFor = (name: string) => {
    let store = stores.get(name);
    if (!store) {
      store = new Map();
      stores.set(name, store);
    }
    const s = store;
    return {
      addAll: vi.fn(async (urls: string[]) => {
        for (const u of urls) s.set(keyOf(u), response());
      }),
      put: vi.fn(async (req: unknown, res: FakeResponse) => {
        s.set(keyOf(req), res);
      }),
      match: async (req: unknown) => s.get(keyOf(req)),
    };
  };

  const caches = {
    open: vi.fn(async (name: string) => cacheFor(name)),
    match: async (req: unknown) => {
      for (const store of stores.values()) {
        const hit = store.get(keyOf(req));
        if (hit) return hit;
      }
      return undefined;
    },
    keys: async () => [...stores.keys()],
    delete: vi.fn(async (name: string) => stores.delete(name)),
  };

  const clients = {
    matchAll: vi.fn(async () => [] as unknown[]),
    openWindow: vi.fn(async () => null),
    claim: vi.fn(async () => {}),
  };

  const self = {
    location: { href: `${ORIGIN}/sw.js?v=1.2.3`, origin: ORIGIN },
    addEventListener: (type: string, fn: Listener) => {
      listeners.set(type, [...(listeners.get(type) ?? []), fn]);
    },
    skipWaiting: vi.fn(async () => {}),
    clients,
    registration: { showNotification: vi.fn(async () => {}) },
  };

  const fetch = vi.fn<(req: unknown) => Promise<FakeResponse>>();

  const context = vm.createContext({ self, caches, fetch, URL, console });
  new vm.Script(SW_SOURCE).runInContext(context);

  const emit = (type: string, event: Record<string, unknown>) => {
    const pending: Promise<unknown>[] = [];
    const ev = {
      ...event,
      waitUntil: (p: Promise<unknown>) => pending.push(p),
    };
    for (const fn of listeners.get(type) ?? []) fn(ev);
    return pending;
  };

  const dispatch = async (type: string, event: Record<string, unknown>) => {
    await Promise.all(emit(type, event));
  };

  const fetchEvent = async (req: unknown) => {
    let responded: Promise<FakeResponse> | undefined;
    const pending = emit("fetch", {
      request: req,
      respondWith: (p: Promise<FakeResponse>) => {
        responded = p;
      },
    });
    const result = responded ? await responded : undefined;
    // Cache writes are registered via waitUntil() inside the response chain,
    // so they only exist once the response has settled.
    await Promise.all(pending);
    return { handled: responded !== undefined, result };
  };

  const install = () => dispatch("install", {});
  const activate = () => dispatch("activate", {});
  const stored = (name: string, path: string) =>
    stores.get(name)?.get(new URL(path, ORIGIN).href);

  return {
    self,
    caches,
    fetch,
    clients,
    install,
    activate,
    fetchEvent,
    dispatch,
    stored,
  };
}

let w: ReturnType<typeof makeWorker>;

beforeEach(() => {
  w = makeWorker();
});

describe("service worker lifecycle", () => {
  it("names caches after the registered version and purges the rest on activate", async () => {
    await w.install();
    expect(w.caches.open).toHaveBeenCalledWith("umamin-static-1.2.3");
    // Simulate a leftover cache from an earlier release.
    await (await w.caches.open("umamin-static-1.2.2")).put(
      request("/x"),
      response(),
    );
    await w.activate();
    expect(w.caches.delete).toHaveBeenCalledWith("umamin-static-1.2.2");
    expect(w.caches.delete).not.toHaveBeenCalledWith("umamin-static-1.2.3");
    expect(w.clients.claim).toHaveBeenCalled();
  });

  it("waits for the page's opt-in before taking over", async () => {
    await w.install();
    expect(w.self.skipWaiting).not.toHaveBeenCalled();
    await w.dispatch("message", { data: { type: "SKIP_WAITING" } });
    expect(w.self.skipWaiting).toHaveBeenCalledTimes(1);
  });
});

describe("navigation requests", () => {
  beforeEach(async () => {
    await w.install();
  });

  it("serves the offline page for a dynamic route (start_url) when the network is down", async () => {
    w.fetch.mockRejectedValue(new TypeError("Failed to fetch"));
    const { handled, result } = await w.fetchEvent(
      request("/feed", { mode: "navigate" }),
    );
    expect(handled).toBe(true);
    expect(result).toBe(w.stored("umamin-static-1.2.3", "/offline.html"));
  });

  it("never stores a dynamic route's HTML", async () => {
    w.fetch.mockResolvedValue(response());
    await w.fetchEvent(request("/inbox", { mode: "navigate" }));
    expect(w.stored("umamin-pages-1.2.3", "/inbox")).toBeUndefined();
    await w.fetchEvent(request("/user/alice", { mode: "navigate" }));
    expect(w.stored("umamin-pages-1.2.3", "/user/alice")).toBeUndefined();
  });

  it("caches a public page and falls back to it offline", async () => {
    w.fetch.mockResolvedValueOnce(response());
    await w.fetchEvent(request("/about", { mode: "navigate" }));
    const cached = w.stored("umamin-pages-1.2.3", "/about");
    expect(cached).toBeDefined();

    w.fetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const { result } = await w.fetchEvent(
      request("/about", { mode: "navigate" }),
    );
    expect(result).toBe(cached);
  });

  it("does not pin an error page for the whole version", async () => {
    w.fetch.mockResolvedValueOnce(response(false));
    await w.fetchEvent(request("/about", { mode: "navigate" }));
    expect(w.stored("umamin-pages-1.2.3", "/about")).toBeUndefined();
  });
});

describe("static assets", () => {
  it("stores only same-origin OK responses, then serves cache-first", async () => {
    w.fetch.mockResolvedValueOnce(response(false));
    await w.fetchEvent(request("/assets/gone.js", { destination: "script" }));
    expect(w.stored("umamin-static-1.2.3", "/assets/gone.js")).toBeUndefined();

    const ok = response();
    w.fetch.mockResolvedValueOnce(ok);
    await w.fetchEvent(request("/assets/app.js", { destination: "script" }));
    w.fetch.mockClear();
    const { result } = await w.fetchEvent(
      request("/assets/app.js", { destination: "script" }),
    );
    expect(result).toBe(ok);
    expect(w.fetch).not.toHaveBeenCalled();
  });

  it("leaves cross-origin and non-GET requests to the browser", async () => {
    const cross = await w.fetchEvent({
      ...request("/x.js", { destination: "script" }),
      url: "https://cdn.example.com/x.js",
    });
    expect(cross.handled).toBe(false);
    const post = await w.fetchEvent(
      request("/api/x", { method: "POST", mode: "navigate" }),
    );
    expect(post.handled).toBe(false);
  });
});

describe("notification click", () => {
  const click = (url: string) =>
    w.dispatch("notificationclick", {
      notification: { close: vi.fn(), data: { url } },
    });

  it("navigates the open window instead of opening a second one", async () => {
    const client = {
      url: `${ORIGIN}/feed`,
      focus: vi.fn(async () => client),
      navigate: vi.fn(async () => client),
    };
    w.clients.matchAll.mockResolvedValue([client]);
    await click("/inbox");
    expect(client.focus).toHaveBeenCalled();
    expect(client.navigate).toHaveBeenCalledWith(`${ORIGIN}/inbox`);
    expect(w.clients.openWindow).not.toHaveBeenCalled();
  });

  it("opens a window only when none is open", async () => {
    w.clients.matchAll.mockResolvedValue([]);
    await click("/inbox");
    expect(w.clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/inbox`);
  });
});
