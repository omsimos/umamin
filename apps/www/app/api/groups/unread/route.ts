import { getSession } from "@/lib/auth";
import { GROUP_CHAT_ENABLED } from "@/lib/group";
import { getGroupUnreadStates } from "@/lib/server/data";
import { withPrivateRead } from "@/lib/server/read-route";

// Per-viewer unread flags for the groups hub dot. Private (no-store); the
// underlying read is two bounded queries over the viewer's <=5 groups.
export const GET = withPrivateRead("fetching group unread", async () => {
  // Chat off — no unread signal, and stale clients skip the DB read entirely.
  if (!GROUP_CHAT_ENABLED) {
    return [];
  }

  const { session } = await getSession();
  if (!session) {
    return [];
  }

  return getGroupUnreadStates(session.userId);
});
