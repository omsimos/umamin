import { Hono } from "hono";
import { type AppBindings, sessionContext } from "../server-lib/context";
import { actionsApp } from "./actions";
import { readsApp } from "./routes";

// Sub-app mounted at /api by the outer server. `sessionContext` attaches the
// lazy, memoized session resolver every action()/read handler relies on.
export const apiApp = new Hono<AppBindings>()
  .use("*", sessionContext())
  .get("/health", (c) => c.json({ ok: true }))
  .route("/", readsApp)
  .route("/", actionsApp);

export type ApiApp = typeof apiApp;
export type { ActionsType } from "./actions";
export type { ReadsApp } from "./routes";
