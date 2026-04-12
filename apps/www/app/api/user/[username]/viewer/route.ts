import { getSession } from "@/lib/auth";
import { privateJson } from "@/lib/private-json";
import { getUserProfileViewerData } from "@/lib/server/data";
import { formatUsername } from "@/lib/utils";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    const { username: rawUsername } = await params;
    const username = formatUsername(rawUsername);
    const { session } = await getSession();
    const result = await getUserProfileViewerData(username, session?.userId);

    if (!result) {
      return privateJson({ error: "Not found" }, { status: 404 });
    }

    return privateJson(result);
  } catch (error) {
    console.error("Error fetching user profile viewer overlay:", error);
    return privateJson({ error: "Internal server error" }, { status: 500 });
  }
}
