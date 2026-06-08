import { getSession } from "@/lib/auth";
import { privateJson } from "@/lib/private-json";
import {
  getGroupPageData,
  getGroupPendingRequestsPage,
  getGroupViewerRelationship,
} from "@/lib/server/data";
import { withPrivateRead } from "@/lib/server/read-route";

// Creator-only pending join requests. Private (no-store).
export const GET = withPrivateRead<{ tag: string }>(
  "fetching group join requests",
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

    // Only the creator owns the request queue. getGroupPageData doesn't expose
    // creatorId, so the relationship check is the gate.
    const relationship = await getGroupViewerRelationship(
      session.userId,
      group.id,
    );
    if (relationship !== "owner") {
      return privateJson({ error: "Unauthorized" }, { status: 403 });
    }

    const cursor = new URL(req.url).searchParams.get("cursor");
    return getGroupPendingRequestsPage(group.id, cursor);
  },
);
