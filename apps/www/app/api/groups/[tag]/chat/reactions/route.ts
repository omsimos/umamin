import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { privateJson } from "@/lib/private-json";
import { checkRateLimit, RATE_LIMIT_ERROR } from "@/lib/ratelimit";
import {
  getGroupMessageReactions,
  getGroupPageData,
  getGroupViewerRelationship,
} from "@/lib/server/data";
import { INTERNAL_SERVER_ERROR } from "@/lib/server/errors";

// Per-viewer reaction overlay for a set of loaded message ids (?ids=a,b,c).
// Members-only, private (no-store), per-user rate-limited like the chat poll.
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ tag: string }> },
) {
  try {
    const { session } = await getSession();
    if (!session) {
      return privateJson({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await checkRateLimit("group-read", `gchatrxn:${session.userId}`))) {
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

    const idsParam = new URL(req.url).searchParams.get("ids");
    const ids = idsParam ? idsParam.split(",").filter(Boolean) : [];
    return privateJson(
      await getGroupMessageReactions(ids, session.userId, group.id),
    );
  } catch (error) {
    console.error("Error fetching group chat reactions:", error);
    return privateJson({ error: INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}
