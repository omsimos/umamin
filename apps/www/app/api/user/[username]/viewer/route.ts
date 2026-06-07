import { getSession } from "@/lib/auth";
import { privateJson } from "@/lib/private-json";
import { getUserProfileViewerData } from "@/lib/server/data";
import { withPrivateRead } from "@/lib/server/read-route";
import { formatUsername } from "@/lib/utils";

export const GET = withPrivateRead<{ username: string }>(
  "fetching user profile viewer overlay",
  async (_req, { params }) => {
    const { username: rawUsername } = await params;
    const username = formatUsername(rawUsername);
    const { session } = await getSession();
    const result = await getUserProfileViewerData(username, session?.userId);

    if (!result) {
      return privateJson({ error: "Not found" }, { status: 404 });
    }

    return result;
  },
);
