// Worker `main` for the chat workers tests. It mounts only the chat socket
// routes behind the real security-headers middleware: the full src/server.ts
// pulls in TanStack Start, which doesn't load in the vitest pool.
import { Hono } from "hono";
import { chatSocketApp } from "../src/api/chat-socket";
import type { AppEnv } from "../src/server-lib/env";
import { securityHeadersMiddleware } from "../src/server-lib/middleware";

export { ChatLobby } from "../src/server-lib/chat/lobby";
export { ChatRoom } from "../src/server-lib/chat/room";

const app = new Hono<{ Bindings: AppEnv }>()
  .use("*", securityHeadersMiddleware())
  .route("/api", chatSocketApp);

export default {
  fetch: (request: Request, env: AppEnv, ctx: ExecutionContext) =>
    app.fetch(request, env, ctx),
} satisfies ExportedHandler<AppEnv>;
