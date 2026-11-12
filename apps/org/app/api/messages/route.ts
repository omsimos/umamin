import { getSession } from "@/lib/auth";
import { privateJson } from "@/lib/private-json";
import { getOrgMessagesPage } from "@/lib/server/data";
import { PASSWORD_CHANGE_REQUIRED_ERROR } from "@/lib/server/errors";
import { withPrivateRead } from "@/lib/server/read-route";

export const GET = withPrivateRead("messages", async (req) => {
  const { session, user } = await getSession();
  if (!session || !user) {
    return privateJson({ error: "Unauthorized" }, { status: 401 });
  }
  // The default invite password must not be enough to read the inbox.
  if (user.mustChangePassword) {
    return privateJson(
      { error: PASSWORD_CHANGE_REQUIRED_ERROR },
      { status: 403 },
    );
  }
  const cursor = new URL(req.url).searchParams.get("cursor");
  return getOrgMessagesPage({ orgId: session.orgId, cursor });
});
