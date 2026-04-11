import { getSession } from "@/lib/auth";
import { getCurrentNoteData } from "@/lib/server/data";

export async function GET() {
  try {
    const { session } = await getSession();

    if (!session?.userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await getCurrentNoteData(session.userId);
    return Response.json(result);
  } catch (error) {
    console.error("Error fetching current note:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
