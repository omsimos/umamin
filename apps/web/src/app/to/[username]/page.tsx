import { graphql } from "gql.tada";
import { redirect } from "next/navigation";

import { getClient } from "@/lib/gql";
import { getSession } from "@/lib/auth";
import { ChatForm } from "./components/chat-form";
import { Card, CardHeader } from "@umamin/ui/components/card";
import { ProfileHoverCard } from "@/app/components/profile-hover-card";

const UserByUsernameQuery = graphql(`
  query UserByUsername($username: String!) {
    userByUsername(username: $username) {
      id
      username
      question
      imageUrl
      createdAt
    }
  }
`);

export default async function SendMessage({
  params,
}: {
  params: { username: string };
}) {
  const { session } = await getSession();

  const result = await getClient().query(UserByUsernameQuery, {
    username: params.username,
  });

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
          userId={user.id}
          sessionId={session?.userId}
          imageUrl={user.imageUrl}
          question={user.question}
        />
      </Card>
    </main>
  );
}
