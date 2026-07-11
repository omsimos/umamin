import { getNotesPage } from "@/lib/server/data";
import { withPublicRead } from "@/lib/server/read-route";

export const GET = withPublicRead(
  "fetching public notes",
  180,
  async (req) => {
    const cursor = req.nextUrl.searchParams.get("cursor");
    return getNotesPage({ cursor });
  },
  60,
);
