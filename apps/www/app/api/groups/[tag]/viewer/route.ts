import { getSession } from "@/lib/auth";
import {
  getGroupPageData,
  getGroupViewerRelationship,
} from "@/lib/server/data";
import { withPrivateRead } from "@/lib/server/read-route";

// Per-viewer relationship — drives the page's request/accept CTA vs owner
// controls.
export const GET = withPrivateRead<{ tag: string }>(
  "fetching group viewer",
  async (_req, { params }) => {
    const { tag } = await params;
    const { session } = await getSession();

    if (!session) {
      return { isAuthenticated: false, relationship: null };
    }

    const group = await getGroupPageData(tag);
    if (!group) {
      return { isAuthenticated: true, relationship: null };
    }

    const relationship = await getGroupViewerRelationship(
      session.userId,
      group.id,
    );
    return { isAuthenticated: true, relationship };
  },
);
