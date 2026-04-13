import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getNotesPage } from "@/lib/server/data";

export async function GET(req: NextRequest) {
  try {
    const cursor = req.nextUrl.searchParams.get("cursor");
    const { session } = await getSession();

    const result = await getNotesPage({
      cursor,
      viewerId: session?.userId,
    });

    return Response.json(result);
  } catch (error) {
    console.error("Error fetching notes:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
