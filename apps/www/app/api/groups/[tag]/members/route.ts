import { getSession } from "@/lib/auth";
import { privateJson } from "@/lib/private-json";
import {
  getGroupMembersPage,
  getGroupPageData,
  getGroupViewerRelationship,
} from "@/lib/server/data";
import { withPrivateRead } from "@/lib/server/read-route";

// Members-only roster: non-members get 403 (the page shows name/tag/icon +
// request CTA instead). Private (no-store) so the roster never lands in a
// shared cache.
export const GET = withPrivateRead<{ tag: string }>(
  "fetching group members",
  async (req, { params }) => {
    const { tag } = await params;
    const { session } = await getSession();

    if (!session) {
      return privateJson({ error: "Unauthorized" }, { status: 401 });
    }

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

    const cursor = new URL(req.url).searchParams.get("cursor");
    return getGroupMembersPage(group.id, cursor);
  },
);
