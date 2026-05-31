import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { privateJson } from "@/lib/private-json";
import { getNotesPage } from "@/lib/server/data";

export async function GET(req: NextRequest) {
  try {
    const cursor = req.nextUrl.searchParams.get("cursor");
    const { session } = await getSession();

    const result = await getNotesPage({
      cursor,
      viewerId: session?.userId,
    });

    return privateJson(result);
  } catch (error) {
    console.error("Error fetching notes:", error);
    return privateJson({ error: "Internal server error" }, { status: 500 });
  }
}
