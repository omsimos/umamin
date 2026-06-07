import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { privateJson } from "@/lib/private-json";
import { getBlockedUsersPage } from "@/lib/server/data";
import { withPrivateRead } from "@/lib/server/read-route";

export const GET = withPrivateRead(
  "fetching blocked users",
  async (req: NextRequest) => {
    const { session } = await getSession();

    if (!session) {
      return privateJson({ error: "Unauthorized" }, { status: 401 });
    }

    const cursor = req.nextUrl.searchParams.get("cursor");

    return getBlockedUsersPage({
      viewerId: session.userId,
      cursor,
    });
  },
);
