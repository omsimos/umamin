import { getSession } from "@/lib/auth";
import { privateJson } from "@/lib/private-json";
import { getOrgMessagesPage } from "@/lib/server/data";
import { withPrivateRead } from "@/lib/server/read-route";

export const GET = withPrivateRead("messages", async (req) => {
  const { session } = await getSession();
  if (!session) {
    return privateJson({ error: "Unauthorized" }, { status: 401 });
  }
  const cursor = new URL(req.url).searchParams.get("cursor");
  return getOrgMessagesPage({ orgId: session.orgId, cursor });
});
