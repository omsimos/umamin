import { publicJson } from "@/lib/public-json";
import { getPostById } from "@/lib/server/data";

const PUBLIC_CACHE_SECONDS = 120;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await getPostById({ postId: id });

    if (!result) {
      return publicJson({ error: "Not found" }, 0, { status: 404 });
    }

    return publicJson(result, PUBLIC_CACHE_SECONDS);
  } catch (error) {
    console.error("Error fetching public post:", error);
    return publicJson({ error: "Internal server error" }, 0, { status: 500 });
  }
}
