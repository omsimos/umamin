import type { Context } from "hono";

export type AppEnv = {
  Variables: {
    requestId: string;
  };
};

export type AppContext = Context<AppEnv>;
