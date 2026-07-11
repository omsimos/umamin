import { getPostCommentsPage } from "@/lib/server/data";
import { withPublicRead } from "@/lib/server/read-route";

export const GET = withPublicRead<{ id: string }>(
  "fetching public comments",
  120,
  async (req, { params }) => {
    const postId = (await params).id;
    const cursor = req.nextUrl.searchParams.get("cursor");
    return getPostCommentsPage({ postId, cursor });
  },
  60,
);
