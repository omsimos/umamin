import { publicJson } from "@/lib/public-json";
import { getPublicUserProfileData } from "@/lib/server/data";
import { formatUsername } from "@/lib/utils";

const PUBLIC_CACHE_SECONDS = 604800;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
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
