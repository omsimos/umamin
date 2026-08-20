import { Hono } from "hono";
import { FLAG_UMAMIN_PRO } from "../../lib/flags";
import type { AppBindings } from "../../server-lib/context";
import { resolveFlags } from "../../server-lib/flags";
import { withPrivateRead } from "../../server-lib/read-route";
import { getSessionFrom } from "./_shared";

// PRIVATE, never cached: flags are evaluated against the viewer's distinct id,
// so a public (shared-cache) response would hand one viewer's rollout bucket to
// everyone. Anonymous callers are allowed — /tiers is a public page.
export const flagsRoutes = new Hono<AppBindings>().get(
  "/flags",
  withPrivateRead("resolving feature flags", async (c) => {
    const { session } = await getSessionFrom(c);
    const flags = await resolveFlags(c.env, session?.userId ?? null, [
      FLAG_UMAMIN_PRO,
    ]);

    return { pro: flags[FLAG_UMAMIN_PRO] ?? false };
  }),
);
