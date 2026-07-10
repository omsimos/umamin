import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { GROUP_CHAT_DISABLED_ERROR, GROUP_CHAT_ENABLED } from "@/lib/group";
import { privateJson } from "@/lib/private-json";
import { checkRateLimit, RATE_LIMIT_ERROR } from "@/lib/ratelimit";
import {
  getGroupMessageReactors,
  getGroupPageData,
  getGroupViewerRelationship,
} from "@/lib/server/data";
import { INTERNAL_SERVER_ERROR } from "@/lib/server/errors";

// The "who reacted" list for one message — members-only, private (no-store),
// per-user rate-limited. Lazily fetched when the reactions drawer opens.
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ tag: string; messageId: string }> },
) {
  try {
    if (!GROUP_CHAT_ENABLED) {
      return privateJson({ error: GROUP_CHAT_DISABLED_ERROR }, { status: 403 });
    }

    const { session } = await getSession();
    if (!session) {
      return privateJson({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await checkRateLimit("group-read", `gchatrxn:${session.userId}`))) {
      return privateJson({ error: RATE_LIMIT_ERROR }, { status: 429 });
    }

    const { tag, messageId } = await ctx.params;
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

    return privateJson(await getGroupMessageReactors(messageId, group.id));
  } catch (error) {
    console.error("Error fetching group chat reactors:", error);
    return privateJson({ error: INTERNAL_SERVER_ERROR }, { status: 500 });
  }
}
