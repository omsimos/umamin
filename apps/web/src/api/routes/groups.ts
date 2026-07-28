import { Hono } from "hono";
import type { AppBindings } from "../../server-lib/context";
import {
  getGroupMembersPage,
  getGroupPageData,
  getGroupPendingRequestsPage,
  getGroupUnreadStates,
  getGroupViewerRelationship,
  getUserGroups,
} from "../../server-lib/data";
import {
  MEMBERS_ONLY_ERROR,
  NOT_FOUND_ERROR,
  UNAUTHORIZED_ERROR,
} from "../../server-lib/errors";
import { GROUP_CHAT_ENABLED } from "../../server-lib/group";
import { withPrivateRead, withPublicRead } from "../../server-lib/read-route";
import { getSessionFrom, resolveDb } from "./_shared";

export const groupsRoutes = new Hono<AppBindings>()
  .get(
    "/groups",
    withPrivateRead("fetching user groups", async (c) => {
      const { session } = await getSessionFrom(c);
      if (!session) {
        return Response.json({ error: UNAUTHORIZED_ERROR }, { status: 401 });
      }
      return getUserGroups(resolveDb(c.env), session.userId);
    }),
  )
  // Per-viewer unread flags for the groups hub dot; two bounded queries.
  .get(
    "/groups/unread",
    withPrivateRead("fetching group unread", async (c) => {
      if (!GROUP_CHAT_ENABLED) return [];
      const { session } = await getSessionFrom(c);
      if (!session) return [];
      return getGroupUnreadStates(resolveDb(c.env), session.userId);
    }),
  )
  // Per-viewer relationship — drives the request/accept CTA vs owner controls.
  .get(
    "/groups/:tag/viewer",
    withPrivateRead("fetching group viewer", async (c) => {
      const db = resolveDb(c.env);
      const { session } = await getSessionFrom(c);
      if (!session) {
        return { isAuthenticated: false, relationship: null };
      }

      const group = await getGroupPageData(db, c.req.param("tag") ?? "");
      if (!group) {
        return { isAuthenticated: true, relationship: null };
      }

      const relationship = await getGroupViewerRelationship(
        db,
        session.userId,
        group.id,
      );
      return { isAuthenticated: true, relationship };
    }),
  )
  // Members-only roster: non-members get 403.
  .get(
    "/groups/:tag/members",
    withPrivateRead("fetching group members", async (c) => {
      const db = resolveDb(c.env);
      const { session } = await getSessionFrom(c);
      if (!session) {
        return Response.json({ error: UNAUTHORIZED_ERROR }, { status: 401 });
      }

      const group = await getGroupPageData(db, c.req.param("tag") ?? "");
      if (!group) {
        return Response.json({ error: NOT_FOUND_ERROR }, { status: 404 });
      }

      const relationship = await getGroupViewerRelationship(
        db,
        session.userId,
        group.id,
      );
      if (relationship !== "owner" && relationship !== "member") {
        return Response.json({ error: MEMBERS_ONLY_ERROR }, { status: 403 });
      }

      return getGroupMembersPage(db, group.id, c.req.query("cursor") ?? null);
    }),
  )
  // Creator-only pending join requests.
  .get(
    "/groups/:tag/requests",
    withPrivateRead("fetching group join requests", async (c) => {
      const db = resolveDb(c.env);
      const { session } = await getSessionFrom(c);
      if (!session) {
        return Response.json({ error: UNAUTHORIZED_ERROR }, { status: 401 });
      }

      const group = await getGroupPageData(db, c.req.param("tag") ?? "");
      if (!group) {
        return Response.json({ error: NOT_FOUND_ERROR }, { status: 404 });
      }

      const relationship = await getGroupViewerRelationship(
        db,
        session.userId,
        group.id,
      );
      if (relationship !== "owner") {
        return Response.json({ error: UNAUTHORIZED_ERROR }, { status: 403 });
      }

      return getGroupPendingRequestsPage(
        db,
        group.id,
        c.req.query("cursor") ?? null,
      );
    }),
  )
  // Group meta is public (only the roster is members-only); CDN-cached.
  .get(
    "/groups/:tag",
    withPublicRead(
      "fetching group",
      120,
      async (req, env) => {
        const result = await getGroupPageData(
          resolveDb(env),
          req.param("tag") ?? "",
        );
        if (!result) {
          return Response.json({ error: NOT_FOUND_ERROR }, { status: 404 });
        }
        return result;
      },
      60,
    ),
  );
