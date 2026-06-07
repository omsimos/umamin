import { getSession } from "@/lib/auth";
import { getNotesPage } from "@/lib/server/data";
import { withPrivateRead } from "@/lib/server/read-route";

export const GET = withPrivateRead("fetching notes", async (req) => {
  const cursor = req.nextUrl.searchParams.get("cursor");
  const { session } = await getSession();

  return getNotesPage({
    cursor,
    viewerId: session?.userId,
  });
});
