import { getSession } from "@/lib/auth";
import { privateJson } from "@/lib/private-json";
import { getPostById } from "@/lib/server/data";
import { withPrivateRead } from "@/lib/server/read-route";

export const GET = withPrivateRead<{ id: string }>(
  "fetching post",
  async (_req, { params }) => {
    const { session } = await getSession();
    const { id } = await params;

    const result = await getPostById({
      postId: id,
      viewerId: session?.userId,
    });

    return privateJson(result);
  },
);
