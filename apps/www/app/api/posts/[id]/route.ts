import { getSession } from "@/lib/auth";
import { getPostById } from "@/lib/server/data";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { session } = await getSession();
    const { id } = await params;

    const result = await getPostById({
      postId: id,
      viewerId: session?.userId,
    });

    return Response.json(result);
  } catch (error) {
    console.error("Error fetching post:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
