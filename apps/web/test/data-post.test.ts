import { postTable } from "@umamin/db/schema/post";
import { userBlockTable, userTable } from "@umamin/db/schema/user";
import { beforeEach, describe, expect, it } from "vitest";
import { getPostById, getPostsPage } from "../src/server-lib/data";
import type { Db } from "../src/server-lib/db";
import { makeTestDb } from "./helpers/db";

// One block probe now covers the post's author AND its embedded quote's author,
// so the two must stay independently enforced: blocking the quote hides only the
// quote, blocking the author hides the whole post.
describe("getPostById block husks (real libSQL)", () => {
  let db: Db;

  beforeEach(async () => {
    db = await makeTestDb();
    await db.insert(userTable).values([
      { id: "author", username: "u_author" },
      { id: "quoted", username: "u_quoted" },
      { id: "viewer", username: "u_viewer" },
    ]);
    await db.insert(postTable).values([
      { id: "q1", content: "quoted", authorId: "quoted" },
      { id: "p1", content: "quoting", authorId: "author", quotedPostId: "q1" },
    ]);
  });

  it("returns the post with the quote nulled when only the quoted author is blocked", async () => {
    await db
      .insert(userBlockTable)
      .values({ id: "b1", blockerId: "quoted", blockedId: "viewer" });

    const post = await getPostById(db, { postId: "p1", viewerId: "viewer" });

    expect(post?.id).toBe("p1");
    expect(post?.quotedPost).toBeNull();
  });

  it("hides the whole post when the post's own author is blocked", async () => {
    await db
      .insert(userBlockTable)
      .values({ id: "b1", blockerId: "viewer", blockedId: "author" });

    expect(
      await getPostById(db, { postId: "p1", viewerId: "viewer" }),
    ).toBeNull();
  });

  it("keeps the quote when neither author is blocked", async () => {
    const post = await getPostById(db, { postId: "p1", viewerId: "viewer" });

    expect(post?.quotedPost?.id).toBe("q1");
    expect(post?.quotedPost?.author.username).toBe("u_quoted");
  });
});

// The database fallback for Hot sorts candidates in memory and pages with a
// cursor filter, so both must order ids the same way. Ids mix upper and lower
// case, which a locale-aware compare orders differently from `<`.
describe("hot feed database fallback paging (real libSQL)", () => {
  it("reaches every post when ties are broken by mixed-case ids", async () => {
    const db = await makeTestDb();
    await db.insert(userTable).values({ id: "author", username: "u_author" });
    const createdAt = new Date(Math.floor(Date.now() / 1000) * 1000);
    const ids = [
      ...Array.from({ length: 19 }, (_, i) => `z${String(i).padStart(2, "0")}`),
      "Bx",
      "aX",
    ];
    await db
      .insert(postTable)
      .values(
        ids.map((id) => ({ id, content: id, authorId: "author", createdAt })),
      );

    const seen: string[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 3; page++) {
      const res = await getPostsPage(db, undefined, { sort: "hot", cursor });
      seen.push(...res.data.map((item) => item.post.id));
      cursor = res.nextCursor;
      if (!cursor) break;
    }

    expect(seen.toSorted()).toEqual(ids.toSorted());
  });
});
