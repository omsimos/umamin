import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { privateJson } from "@/lib/private-json";
import { checkRateLimit, RATE_LIMIT_ERROR } from "@/lib/ratelimit";
import {
  getGroupMessagesPage,
  getGroupMessagesSince,
  getGroupPageData,
  getGroupViewerRelationship,
} from "@/lib/server/data";
import { INTERNAL_SERVER_ERROR } from "@/lib/server/errors";

// Members-only chat reads. Two shapes on one handler:
//   ?since=<cursor>  → live delta (messages newer than the client's edge), uncached
//   ?cursor=<cursor> → older history page (or first page when absent), cached
// Private (no-store) and rate-limited PER USER (not per IP like withPrivateRead)
// so a NAT'd room of members polling can't throttle one another.
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ tag: string }> },
) {
  try {
    const { session } = await getSession();
    if (!session) {
      return privateJson({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await checkRateLimit("group-read", `gchat:${session.userId}`))) {
      return privateJson({ error: RATE_LIMIT_ERROR }, { status: 429 });
    }

    const { tag } = await ctx.params;
    const group = await getGroupPageData(tag);
    if (!group) {
      return privateJson({ error: "Not found" }, { status: 404 });
    }

    const relationship = await getGroupViewerRelationship(
      session.userId,
      group.id,
    );
    if (relationship !== "owner" && relationship !== "member") {
      return privateJson({ error: "Members only" }, { status: 403 });
    }

    const params = new URL(req.url).searchParams;
    const since = params.get("since");
    if (since) {
      return privateJson(await getGroupMessagesSince(group.id, since));
    }

    return privateJson(
      await getGroupMessagesPage(group.id, params.get("cursor")),
    );
  } catch (error) {
    console.error("Error fetching group chat:", error);
    return privateJson({ error: INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}
