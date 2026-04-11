import { getSession } from "@/lib/auth";
import { getCurrentUserData } from "@/lib/server/data";

export async function GET() {
  try {
    const { session } = await getSession();

    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await getCurrentUserData(session.userId);
    return Response.json(result);
  } catch (error) {
    console.error("Error fetching current user:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
