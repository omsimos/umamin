import { getSession } from "@/lib/auth";
import { privateJson } from "@/lib/private-json";
import { getCurrentNoteData } from "@/lib/server/data";
import { withPrivateRead } from "@/lib/server/read-route";

export const GET = withPrivateRead("fetching current note", async () => {
  const { session } = await getSession();

  if (!session?.userId) {
    return privateJson({ error: "Unauthorized" }, { status: 401 });
  }

  return getCurrentNoteData(session.userId);
});
