import { getSession } from "@/lib/auth";
import { privateJson } from "@/lib/private-json";
import { getCurrentUserData } from "@/lib/server/data";
import { withPrivateRead } from "@/lib/server/read-route";

export const GET = withPrivateRead("fetching current user", async () => {
  const { session } = await getSession();

  if (!session) {
    return privateJson({ error: "Unauthorized" }, { status: 401 });
  }

  return getCurrentUserData(session.userId);
});
