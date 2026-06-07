import { publicJson } from "@/lib/public-json";
import { getPostById } from "@/lib/server/data";
import { withPublicRead } from "@/lib/server/read-route";

export const GET = withPublicRead<{ id: string }>(
  "fetching public post",
  120,
  async (_req, { params }) => {
    const { id } = await params;
    const result = await getPostById({ postId: id });

    if (!result) {
      return publicJson({ error: "Not found" }, 0, { status: 404 });
    }

    return result;
  },
);
