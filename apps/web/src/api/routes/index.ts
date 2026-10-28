import { Hono } from "hono";
import type { AppBindings } from "../../server-lib/context";
import { readsSessionContext } from "./_shared";
import { blockedUsersRoutes } from "./blocked-users";
import { dmRoutes } from "./dm";
import { flagsRoutes } from "./flags";
import { groupsRoutes } from "./groups";
import { meRoutes } from "./me";
import { messagesRoutes } from "./messages";
import { moderationRoutes } from "./moderation";
import { mutedUsersRoutes } from "./muted-users";
import { notesRoutes } from "./notes";
import { notificationsRoutes } from "./notifications";
import { postsRoutes } from "./posts";
import { publicRoutes } from "./public";
import { usersRoutes } from "./users";

// The Phase 2b GET route handlers ported from apps/www/app/api/**, grouped by
// resource, aggregated into one sub-app. Paths mirror apps/www EXACTLY minus the
// `/api` prefix (the orchestrator mounts this under `/api`), so the frontend
// fetchers and the parity diff see byte-identical JSON bodies.
//
// `readsSessionContext` attaches the memoized, seam-aware session resolver every
// private handler reads via `getSessionFrom(c)`.
export const readsApp = new Hono<AppBindings>()
  .use("*", readsSessionContext())
  .route("/", postsRoutes)
  .route("/", notesRoutes)
  .route("/", meRoutes)
  .route("/", messagesRoutes)
  .route("/", dmRoutes)
  .route("/", blockedUsersRoutes)
  .route("/", mutedUsersRoutes)
  .route("/", notificationsRoutes)
  .route("/", usersRoutes)
  .route("/", groupsRoutes)
  .route("/", publicRoutes)
  .route("/", moderationRoutes)
  .route("/", flagsRoutes);

export type ReadsApp = typeof readsApp;
