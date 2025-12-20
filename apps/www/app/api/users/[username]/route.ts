import { db } from "@umamin/db";
import { userFollowTable, userTable } from "@umamin/db/schema/user";
import { and, eq, exists } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { getSession } from "@/lib/auth";

const revalidate = 604800; // 7 days

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    const { username } = await params;

    const getCached = async () => {
      "use cache";
      cacheTag(`user:${username}`);
      cacheLife({ revalidate });

      const [user] = await db
        .select({
          id: userTable.id,
          username: userTable.username,
          displayName: userTable.displayName,
          imageUrl: userTable.imageUrl,
          bio: userTable.bio,
          question: userTable.question,
          quietMode: userTable.quietMode,
          followerCount: userTable.followerCount,
          followingCount: userTable.followingCount,
          createdAt: userTable.createdAt,
          updatedAt: userTable.updatedAt,
        })
        .from(userTable)
        .where(eq(userTable.username, username))
        .limit(1);
      return user;
    };

    const user = await getCached();

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const { session } = await getSession();

    if (!session) {
      return Response.json(user);
    }

    const isFollowing = await (async () => {
      "use cache: private";
      cacheTag(`user:${username}:followed:${session.userId}`);
      cacheLife({ revalidate: 30 });

      const follow = await db
        .select({
          following: exists(
            db
              .select({ id: userFollowTable.id })
              .from(userFollowTable)
              .where(
                and(
                  eq(userFollowTable.followerId, session.userId),
                  eq(userFollowTable.followingId, user.id),
                ),
              ),
          ),
        })
        .from(userTable)
        .where(eq(userTable.id, user.id))
        .limit(1);

      return Boolean(follow?.[0]?.following);
    })();

    return Response.json({ ...user, isFollowing });
  } catch (error) {
    console.error("Error fetching user:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
