import { getSession } from "@/lib/auth";
import { privateJson } from "@/lib/private-json";
import { checkReadRateLimit, RATE_LIMIT_ERROR } from "@/lib/ratelimit";
import { getCurrentNoteData } from "@/lib/server/data";

export async function GET() {
  try {
    if (!(await checkReadRateLimit())) {
      return privateJson({ error: RATE_LIMIT_ERROR }, { status: 429 });
    }

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
