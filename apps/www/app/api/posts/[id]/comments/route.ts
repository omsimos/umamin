import { getSession } from "@/lib/auth";
import { getPostCommentsPage } from "@/lib/server/data";
import { withPrivateRead } from "@/lib/server/read-route";

export const GET = withPrivateRead<{ id: string }>(
  "fetching comments",
  async (req, { params }) => {
    const postId = (await params).id;
    const cursor = req.nextUrl.searchParams.get("cursor");
    const { session } = await getSession();

    return getPostCommentsPage({
      postId,
      cursor,
      viewerId: session?.userId,
    });
  },
);
