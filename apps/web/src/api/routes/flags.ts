import { Hono } from "hono";
import { FLAG_UMAMIN_PRO } from "../../lib/flags";
import type { AppBindings } from "../../server-lib/context";
import {
  isDmEnabled,
  isModerationEnforced,
  isUmaminChatEnabled,
  resolveFlags,
} from "../../server-lib/flags";
import { withPrivateRead } from "../../server-lib/read-route";
import { getSessionFrom } from "./_shared";

// PRIVATE, never cached: flags are evaluated against the viewer's distinct id,
// so a public (shared-cache) response would hand one viewer's rollout bucket to
// everyone. Anonymous callers are allowed — /tiers is a public page.
export const flagsRoutes = new Hono<AppBindings>().get(
  "/flags",
  withPrivateRead("resolving feature flags", async (c) => {
    const { session } = await getSessionFrom(c);
    const [flags, contentModeration, chat, dm] = await Promise.all([
      resolveFlags(c.env, session?.userId ?? null, [FLAG_UMAMIN_PRO]),
      // Global, not per viewer (see lib/flags.ts); read here so settings can
      // hide the content-filter switches while the feature is off.
      isModerationEnforced(c.env),
      isUmaminChatEnabled(c.env),
      isDmEnabled(c.env),
    ]);

    return {
      pro: flags[FLAG_UMAMIN_PRO] ?? false,
      contentModeration,
      chat,
      dm,
    };
  }),
);
