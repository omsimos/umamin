import { getSession } from "@/lib/auth";
import { privateJson } from "@/lib/private-json";
import { getUserGroups } from "@/lib/server/data";
import { withPrivateRead } from "@/lib/server/read-route";

export const GET = withPrivateRead("fetching user groups", async () => {
  const { session } = await getSession();

  if (!session) {
    return privateJson({ error: "Unauthorized" }, { status: 401 });
  }

  return getUserGroups(session.userId);
});
