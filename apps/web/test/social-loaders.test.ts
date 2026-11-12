import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/query";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn<(path: string) => Promise<unknown>>(),
  cookie: vi.fn<() => Promise<boolean | null>>(),
  viewer: vi.fn<() => Promise<{ user?: { id: string } } | null>>(),
}));

// Every loader read goes through these two modules, so stubbing them by path
// records which reads a loader starts and in what order.
vi.mock("@/lib/loader-fetch", () => ({
  loaderFetchJson: (path: string) => mocks.fetch(path),
  loaderFetchJsonOrNull: (path: string) => mocks.fetch(path),
  ssrSessionCookiePresent: () => mocks.cookie(),
}));
vi.mock("@/lib/loader-viewer", () => ({
  loadViewer: () => mocks.viewer(),
  loadViewerId: async () => (await mocks.viewer())?.user?.id ?? null,
}));

import { Route as FeedRoute } from "@/routes/_social/feed";
import { Route as NotesRoute } from "@/routes/_social/notes";
import { Route as UserRoute } from "@/routes/_social/user.$username";

type Loader = (ctx: unknown) => Promise<unknown>;
const runLoader = (route: { options: { loader?: unknown } }, ctx: unknown) =>
  (route.options.loader as Loader)(ctx);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

// Lets every already-started async step run.
const flush = () => new Promise((r) => setTimeout(r, 0));

const page = (id: string) => ({ data: [{ id }], nextCursor: null });
const profile = { id: "target", username: "target", followerCount: 3 };
const overlay = { isAuthenticated: true, isFollowing: true };

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = new QueryClient();
  mocks.fetch.mockReset();
  mocks.cookie.mockReset();
  mocks.viewer.mockReset();
});

describe("/user/$username loader", () => {
  const ctx = (preload = false) => ({
    context: { queryClient },
    params: { username: "target" },
    preload,
  });

  it("starts the posts page and the follow state alongside the profile", async () => {
    const profileRead = deferred<unknown>();
    mocks.cookie.mockResolvedValue(true);
    mocks.viewer.mockResolvedValue({ user: { id: "viewer" } });
    mocks.fetch.mockImplementation(async (path) => {
      if (path === "/api/public/user/target") return profileRead.promise;
      if (path === "/api/public/user/target/posts") return page("p1");
      if (path === "/api/user/target/viewer") return overlay;
      throw new Error(`unexpected ${path}`);
    });

    const loading = runLoader(UserRoute, ctx());
    await flush();

    // Both secondary reads are already out while the profile is still pending.
    expect(mocks.fetch).toHaveBeenCalledWith("/api/public/user/target/posts");
    expect(mocks.fetch).toHaveBeenCalledWith("/api/user/target/viewer");

    profileRead.resolve(profile);
    await expect(loading).resolves.toMatchObject({ username: "target" });

    expect(
      queryClient.getQueryData(queryKeys.userPosts("target")),
    ).toMatchObject({ pages: [page("p1")], pageParams: [null] });
    expect(
      queryClient.getQueryData(queryKeys.userProfileViewer("target")),
    ).toEqual(overlay);
  });

  it("still renders the profile when the posts and follow state fail", async () => {
    mocks.cookie.mockResolvedValue(true);
    mocks.viewer.mockResolvedValue({ user: { id: "viewer" } });
    mocks.fetch.mockImplementation(async (path) => {
      if (path === "/api/public/user/target") return profile;
      throw new Error("turso timeout");
    });

    await expect(runLoader(UserRoute, ctx())).resolves.toMatchObject({
      user: profile,
    });
    expect(
      queryClient.getQueryData(queryKeys.userPosts("target")),
    ).toBeUndefined();
  });

  it("skips the private follow state without a session cookie or on preload", async () => {
    mocks.viewer.mockResolvedValue(null);
    mocks.fetch.mockImplementation(async (path) =>
      path.endsWith("/posts") ? page("p1") : profile,
    );

    mocks.cookie.mockResolvedValue(false);
    await runLoader(UserRoute, ctx());
    mocks.cookie.mockResolvedValue(true);
    await runLoader(UserRoute, ctx(true));

    expect(mocks.fetch).not.toHaveBeenCalledWith("/api/user/target/viewer");
  });

  describe("profile cache entry", () => {
    const key = queryKeys.userProfile("target");
    const cachedFollowers = () =>
      queryClient.getQueryData<typeof profile>(key)?.followerCount;

    beforeEach(() => {
      mocks.cookie.mockResolvedValue(false);
      mocks.viewer.mockResolvedValue(null);
      mocks.fetch.mockImplementation(async (path) =>
        path.endsWith("/posts") ? page("p1") : profile,
      );
    });

    it("seeds an empty profile cache", async () => {
      await runLoader(UserRoute, ctx());

      expect(queryClient.getQueryData(key)).toEqual(profile);
    });

    it("keeps a profile this device just patched", async () => {
      queryClient.setQueryData(key, { ...profile, followerCount: 4 });

      await expect(runLoader(UserRoute, ctx())).resolves.toMatchObject({
        user: { followerCount: 4 },
      });
      expect(cachedFollowers()).toBe(4);

      await expect(runLoader(UserRoute, ctx(true))).resolves.toMatchObject({
        user: { followerCount: 4 },
      });
      expect(cachedFollowers()).toBe(4);
    });

    it("replaces a profile entry older than the Worker cache window", async () => {
      queryClient.setQueryData(
        key,
        { ...profile, followerCount: 4 },
        { updatedAt: Date.now() - 301_000 },
      );

      await runLoader(UserRoute, ctx());

      expect(cachedFollowers()).toBe(3);
    });
  });
});

describe("signed-in /feed and /notes loaders", () => {
  it.each([
    {
      name: "feed",
      route: FeedRoute,
      ctx: () => ({ context: { queryClient }, deps: { sort: "hot" } }),
      signedIn: "/api/posts?sort=hot",
      key: (viewer: string) => queryKeys.posts("hot", viewer),
    },
    {
      name: "notes",
      route: NotesRoute,
      ctx: () => ({ context: { queryClient } }),
      signedIn: "/api/notes",
      key: (viewer: string) => queryKeys.notes(viewer),
    },
  ])("$name requests page 1 before the viewer resolves", async (c) => {
    const viewer = deferred<{ user: { id: string } }>();
    mocks.cookie.mockResolvedValue(true);
    mocks.viewer.mockReturnValue(viewer.promise);
    mocks.fetch.mockResolvedValue(page("first"));

    const loading = runLoader(c.route, c.ctx());
    await flush();
    expect(mocks.fetch).toHaveBeenCalledWith(c.signedIn);

    viewer.resolve({ user: { id: "v1" } });
    await loading;

    // The early request is the one that fills the cache; no second page 1.
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(c.key("v1"))).toMatchObject({
      pages: [page("first")],
    });
  });

  it.each([
    {
      name: "feed",
      route: FeedRoute,
      ctx: () => ({ context: { queryClient }, deps: { sort: "hot" } }),
      publicPath: "/api/public/posts?sort=hot",
      key: queryKeys.posts("hot", "public"),
    },
    {
      name: "notes",
      route: NotesRoute,
      ctx: () => ({ context: { queryClient } }),
      publicPath: "/api/public/notes",
      key: queryKeys.notes("public"),
    },
  ])("$name falls back to the public page for a stale cookie", async (c) => {
    mocks.cookie.mockResolvedValue(true);
    mocks.viewer.mockResolvedValue(null);
    mocks.fetch.mockImplementation(async (path) =>
      path.startsWith("/api/public/")
        ? page("public")
        : Promise.reject(new Error("401")),
    );

    await runLoader(c.route, c.ctx());

    expect(mocks.fetch).toHaveBeenCalledWith(c.publicPath);
    expect(queryClient.getQueryData(c.key)).toMatchObject({
      pages: [page("public")],
    });
  });
});
