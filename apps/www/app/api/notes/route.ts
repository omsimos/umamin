import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { privateJson } from "@/lib/private-json";
import { checkReadRateLimit, RATE_LIMIT_ERROR } from "@/lib/ratelimit";
import { getNotesPage } from "@/lib/server/data";

export async function GET(req: NextRequest) {
  try {
    if (!(await checkReadRateLimit())) {
      return privateJson({ error: RATE_LIMIT_ERROR }, { status: 429 });
    }

    const cursor = req.nextUrl.searchParams.get("cursor");
    const { session } = await getSession();

    const result = await getNotesPage({
      cursor,
      viewerId: session?.userId,
    });

    return privateJson(result);
  } catch (error) {
    console.error("Error fetching notes:", error);
    return privateJson({ error: "Internal server error" }, { status: 500 });
  }
}
