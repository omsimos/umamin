import { getPublicUserProfileData } from "@/lib/server/data";
import { formatUsername } from "@/lib/utils";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    const { username: rawUsername } = await params;
    const username = formatUsername(rawUsername);
    const result = await getPublicUserProfileData(username);

    if (!result) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json(result);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
