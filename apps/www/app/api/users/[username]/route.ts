import { db } from "@umamin/db";
import { userTable } from "@umamin/db/schema/user";
import { eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";

export const revalidate = 604800; // 7 days

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    const { username } = await params;

    const getCached = unstable_cache(
      async () => {
        const [user] = await db
          .select({
            id: userTable.id,
            username: userTable.username,
            displayName: userTable.displayName,
            imageUrl: userTable.imageUrl,
            bio: userTable.bio,
            question: userTable.question,
            quietMode: userTable.quietMode,
            createdAt: userTable.createdAt,
            updatedAt: userTable.updatedAt,
          })
          .from(userTable)
          .where(eq(userTable.username, username))
          .limit(1);
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
