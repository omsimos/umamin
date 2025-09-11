import { eq } from "drizzle-orm";
import { db } from "@umamin/db";
import { userTable } from "@umamin/db/schema/user";
import { unstable_cache } from "next/cache";

export const revalidate = 86400; // 24h

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    const { username } = await params;

    const getCached = unstable_cache(
      async () => {
        const user = await db.query.userTable.findFirst({
          where: eq(userTable.username, username),
          columns: {
            id: true,
            username: true,
            displayName: true,
            imageUrl: true,
            bio: true,
            question: true,
            quietMode: true,
            createdAt: true,
            updatedAt: true,
          },
        });
        return user;
      },
      ["api-user-by-username", username],
      {
        revalidate,
        tags: [`user:${username}`],
      },
    );

    const user = await getCached();

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    return Response.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
