import { cache } from "react";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/gql/rsc";
import { ChatForm } from "./components/chat-form";
import { USER_BY_USERNAME_QUERY } from "./queries";
import { BadgeCheck, MessageCircleOff } from "lucide-react";
import { ShareButton } from "@/app/components/share-button";
import { Card, CardHeader } from "@umamin/ui/components/card";

const UnauthenticatedDialog = dynamic(
  () => import("./components/unauthenticated"),
  { ssr: false },
);

const getUser = cache(async (username: string) => {
  const res = await getClient().query(USER_BY_USERNAME_QUERY, {
    username,
  });

  return res;
});

export default async function SendMessage({
  params,
}: {
  params: { username: string };
}) {
  const { session } = await getSession();

  const result = await getUser(params.username);
  const user = result.data?.userByUsername;

  if (!user) {
    redirect("/404");
  }

  return (
    <main className="mt-36 pb-24 grid place-items-center container">
      <Card className="border flex flex-col w-full max-w-2xl">
        <CardHeader className="bg-background border-b w-full item-center rounded-t-2xl flex justify-between flex-row">
          <div className="flex items-center space-x-1">
            <span className="text-muted-foreground">To:</span>
            <p className="font-semibold text-sm">
              {user?.displayName ?? user?.username}
            </p>
            {process.env.NEXT_PUBLIC_VERIFIED_USERS?.split(",").includes(
              user.username,
            ) && <BadgeCheck className="w-4 h-4 text-pink-500" />}
            {user.quietMode && (
              <MessageCircleOff className="h-4 w-4 text-pink-500" />
            )}

            <ShareButton username={user.username} />
          </div>

          {/* <ProfileHoverCard 
            user={{
              username: user.username,
              imageUrl: user.imageUrl,
              createdAt: user.createdAt,
            }}
          >
            <p className="text-muted-foreground text-sm">@{user.username}</p>
          </ProfileHoverCard> */}

          <span className="font-semibold text-muted-foreground pb-2">umamin</span>
        </CardHeader>

        <ChatForm currentUserId={session?.userId} user={user} />
      </Card>

      <UnauthenticatedDialog isLoggedIn={!!session} />
    </main>
  );
}
