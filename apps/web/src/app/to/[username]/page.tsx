import { cache } from "react";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth";
import { getClient } from "@/lib/gql/rsc";
import { ChatForm } from "./components/chat-form";
import { USER_BY_USERNAME_QUERY } from "./queries";
import { Card, CardHeader } from "@umamin/ui/components/card";
import { ProfileHoverCard } from "@/app/components/profile-hover-card";

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
    <main className="mt-36 grid place-items-center container">
      <Card className="border flex flex-col w-full max-w-2xl">
        <CardHeader className="bg-background border-b w-full item-center rounded-t-2xl flex justify-between flex-row">
          <div className="flex items-center space-x-2">
            <span className="text-muted-foreground">To:</span>
            <ProfileHoverCard
              user={{
                username: user.username,
                imageUrl: user.imageUrl,
                createdAt: user.createdAt,
              }}
            >
              <div>
                <p className="font-medium leading-none cursor-pointer">
                  @{user.username}
                </p>
              </div>
            </ProfileHoverCard>
          </div>

          <span className="font-semibold text-muted-foreground">umamin</span>
        </CardHeader>

        <ChatForm
          currentUserId={session?.userId}
          user={user}
        />
      </Card>
    </main>
  );
}
