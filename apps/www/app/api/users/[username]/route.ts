import { eq } from "drizzle-orm";
import { db } from "@umamin/db/index";
import { userTable } from "@umamin/db/schema/user";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    const { username } = await params;

    const user = await db.query.userTable.findFirst({
      where: eq(userTable.username, username),
    });

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    return Response.json(user);
  } catch (error) {
    console.error("Error fetching post:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
