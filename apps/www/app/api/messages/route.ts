import { getSession } from "@/lib/auth";
import { privateJson } from "@/lib/private-json";
import { getMessagesPage } from "@/lib/server/data";
import { withPrivateRead } from "@/lib/server/read-route";

export const GET = withPrivateRead("fetching messages", async (req) => {
  const { session } = await getSession();

  if (!session) {
    return privateJson({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const cursor = searchParams.get("cursor");
  const typeParam = searchParams.get("type");
  const type = typeParam === "sent" ? "sent" : "received";

  return getMessagesPage({
    type,
    cursor,
    userId: session.userId,
  });
});
