import { getSession } from "@/lib/auth";
import { privateJson } from "@/lib/private-json";
import { getCurrentOrg } from "@/lib/server/data";
import { withPrivateRead } from "@/lib/server/read-route";

// No in-app consumer (pages read the org via RSC getSession) — kept as the
// canonical "who am I" surface, mirroring www's /api/me.
export const GET = withPrivateRead("me", async () => {
  const { session } = await getSession();
  if (!session) {
    return privateJson({ error: "Unauthorized" }, { status: 401 });
  }
  const org = await getCurrentOrg(session.orgId);
  if (!org) {
    return privateJson({ error: "Unauthorized" }, { status: 401 });
  }
  return org;
});
