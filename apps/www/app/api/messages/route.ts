import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { privateJson } from "@/lib/private-json";
import { getMessagesPage } from "@/lib/server/data";

export async function GET(req: NextRequest) {
  try {
    const { session } = await getSession();

    if (!session) {
      return privateJson({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const cursor = searchParams.get("cursor");
    const typeParam = searchParams.get("type");
    const type = typeParam === "sent" ? "sent" : "received";

    const result = await getMessagesPage({
      type,
      cursor,
      userId: session.userId,
    });

    return privateJson(result);
  } catch (error) {
    console.error("Error fetching messages:", error);
    return privateJson({ error: "Internal server error" }, { status: 500 });
  }
}
