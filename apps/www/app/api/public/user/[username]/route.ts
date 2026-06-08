import { publicJson } from "@/lib/public-json";
import { getPublicUserProfileWithBadge } from "@/lib/server/data";
import { withPublicRead } from "@/lib/server/read-route";
import { formatUsername } from "@/lib/utils";

export const GET = withPublicRead<{ username: string }>(
  "fetching public user profile",
  604800,
  async (_req, { params }) => {
    const { username: rawUsername } = await params;
    const username = formatUsername(rawUsername);
    const result = await getPublicUserProfileWithBadge(username);

    if (!result) {
      return publicJson({ error: "Not found" }, 0, { status: 404 });
    }

    return result;
  },
);
