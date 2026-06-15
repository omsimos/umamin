import { getSession } from "@/lib/auth";
import { privateJson } from "@/lib/private-json";
import { listDeniedIps } from "@/lib/server/ip-denylist";
import { isModerator } from "@/lib/server/moderation";
import { withPrivateRead } from "@/lib/server/read-route";

export const GET = withPrivateRead("fetching ip denylist", async () => {
  const { user } = await getSession();
  // Return 404 (not 403) for non-moderators so the route's existence/role gate
  // isn't disclosed — mirrors the mod-delete actions' generic "not found".
  if (!isModerator(user)) {
    return privateJson({ error: "Not found" }, { status: 404 });
  }

  const ips = await listDeniedIps();
  return { ips };
});
