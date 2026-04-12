import { getSession } from "@/lib/auth";
import { privateJson } from "@/lib/private-json";
import { getCurrentUserData } from "@/lib/server/data";

export async function GET() {
  try {
    const { session } = await getSession();

    if (!session) {
      return privateJson({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await getCurrentUserData(session.userId);
    return privateJson(result);
  } catch (error) {
    console.error("Error fetching current user:", error);
    return privateJson({ error: "Internal server error" }, { status: 500 });
  }
}
