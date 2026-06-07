import { getSession } from "@/lib/auth";
import { privateJson } from "@/lib/private-json";
import { getNotificationBadgeData } from "@/lib/server/data";
import { withPrivateRead } from "@/lib/server/read-route";

export const GET = withPrivateRead("fetching notification badge", async () => {
  const { session } = await getSession();

  if (!session) {
    return privateJson({ error: "Unauthorized" }, { status: 401 });
  }

  return getNotificationBadgeData(session.userId);
});
