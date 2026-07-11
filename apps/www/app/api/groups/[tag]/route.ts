import { publicJson } from "@/lib/public-json";
import { getGroupPageData } from "@/lib/server/data";
import { withPublicRead } from "@/lib/server/read-route";

// Group meta (name/tag/icon/memberCount/creator) is public — only the roster
// is members-only. CDN-cached for the public revalidate window.
export const GET = withPublicRead<{ tag: string }>(
  "fetching group",
  120,
  async (_req, { params }) => {
    const { tag } = await params;
    const result = await getGroupPageData(tag);

    if (!result) {
      return publicJson({ error: "Not found" }, 0, { status: 404 });
    }

    return result;
  },
  60,
);
