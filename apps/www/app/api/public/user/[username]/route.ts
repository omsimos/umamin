import { publicJson } from "@/lib/public-json";
import { checkReadRateLimit, RATE_LIMIT_ERROR } from "@/lib/ratelimit";
import { getPublicUserProfileData } from "@/lib/server/data";
import { formatUsername } from "@/lib/utils";

const PUBLIC_CACHE_SECONDS = 604800;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    if (!(await checkReadRateLimit())) {
      return publicJson({ error: RATE_LIMIT_ERROR }, 0, { status: 429 });
    }

    const { username: rawUsername } = await params;
    const username = formatUsername(rawUsername);
    const result = await getPublicUserProfileData(username);

    if (!result) {
      return publicJson({ error: "Not found" }, 0, { status: 404 });
    }

    return publicJson(result, PUBLIC_CACHE_SECONDS);
  } catch (error) {
    console.error("Error fetching public user profile:", error);
    return publicJson({ error: "Internal server error" }, 0, { status: 500 });
  }
}
