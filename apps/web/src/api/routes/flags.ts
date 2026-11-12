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

// PRIVATE, never cached. /flags carries only global switches and needs no
// session, so no page waits on a per-user PostHog lookup for them. /flags/pro
// is evaluated against the viewer's id; a shared response would hand one
// viewer's rollout to everyone. Anonymous callers are allowed on both: /tiers
// is a public page.
export const flagsRoutes = new Hono<AppBindings>()
  .get(
    "/flags",
    withPrivateRead("resolving feature flags", async (c) => {
      const [contentModeration, chat, dm] = await Promise.all([
        isModerationEnforced(c.env),
        isUmaminChatEnabled(c.env),
        isDmEnabled(c.env),
      ]);
      return { contentModeration, chat, dm };
    }),
  )
  .get(
    "/flags/pro",
    withPrivateRead("resolving the pro offer flag", async (c) => {
      const { session } = await getSessionFrom(c);
      const flags = await resolveFlags(c.env, session?.userId ?? null, [
        FLAG_UMAMIN_PRO,
      ]);
      return { pro: flags[FLAG_UMAMIN_PRO] ?? false };
    }),
  );
