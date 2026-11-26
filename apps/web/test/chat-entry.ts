// Worker `main` for the workers tests that need real requests (SELF.fetch):
// the chat and DM sockets behind the real security-headers middleware, and the
// shared-lookup routes. The full src/server.ts pulls in TanStack Start, which
// doesn't load in the vitest pool.
import { Hono } from "hono";
import { chatSocketApp } from "../src/api/chat-socket";
import { dmSocketApp } from "../src/api/dm-socket";
import { sessionContext } from "../src/server-lib/context";
import type { AppEnv } from "../src/server-lib/env";
import { securityHeadersMiddleware } from "../src/server-lib/middleware";
import { runInRequestScope } from "../src/server-lib/request-scope";
import { sharedLookupRoutes } from "./shared-lookup-routes";

export { ChatLobby } from "../src/server-lib/chat/lobby";
export { ChatRoom } from "../src/server-lib/chat/room";
export { DmRoom } from "../src/server-lib/dm/room";

const app = new Hono<{ Bindings: AppEnv }>()
  .use("*", securityHeadersMiddleware())
  .use("/api/*", sessionContext())
  .route("/api", chatSocketApp)
  .route("/api", dmSocketApp)
  .route("/__test", sharedLookupRoutes);

export default {
  fetch: (request: Request, env: AppEnv, ctx: ExecutionContext) =>
    runInRequestScope(() => app.fetch(request, env, ctx)),
} satisfies ExportedHandler<AppEnv>;
