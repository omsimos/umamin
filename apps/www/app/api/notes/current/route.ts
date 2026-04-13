import { getSession } from "@/lib/auth";
import { privateJson } from "@/lib/private-json";
import { getCurrentNoteData } from "@/lib/server/data";

export async function GET() {
  try {
    const { session } = await getSession();

    if (!session?.userId) {
      return privateJson({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await getCurrentNoteData(session.userId);
    return privateJson(result);
  } catch (error) {
    console.error("Error fetching current note:", error);
    return privateJson({ error: "Internal server error" }, { status: 500 });
  }
}
