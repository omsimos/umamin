import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { privateJson } from "@/lib/private-json";
import { checkReadRateLimit, RATE_LIMIT_ERROR } from "@/lib/ratelimit";
import { getBlockedUsersPage } from "@/lib/server/data";

export async function GET(req: NextRequest) {
  try {
    if (!(await checkReadRateLimit())) {
      return privateJson({ error: RATE_LIMIT_ERROR }, { status: 429 });
    }

    const { session } = await getSession();

    if (!session) {
      return privateJson({ error: "Unauthorized" }, { status: 401 });
    }

    const cursor = req.nextUrl.searchParams.get("cursor");

    const result = await getBlockedUsersPage({
      viewerId: session.userId,
      cursor,
    });

    return privateJson(result);
  } catch (error) {
    console.error("Error fetching blocked users:", error);
    return privateJson({ error: "Internal server error" }, { status: 500 });
  }
}
