import { Suspense } from "react";
import { graphql } from "gql.tada";
import { ScanFace } from "lucide-react";
import { redirect } from "next/navigation";

import { getClient } from "@/lib/gql";
import { getSession } from "@/lib/auth";
import { ProfileHoverCard } from "@/app/components/profile-hover-card";
import { Card, CardHeader } from "@umamin/ui/components/card";
import { ChatForm } from "./components/chat-form";

import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@umamin/ui/components/avatar";
import { cn } from "@umamin/ui/lib/utils";

const GetUserByUsernameQuery = graphql(`
  query GetUserByUsername($username: String!) {
    getUserByUsername(username: $username) {
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
  const result = await getClient().query(GetUserByUsernameQuery, {
    username: params.username,
  });

  const user = result.data?.getUserByUsername;

  if (!user) {
    redirect("/404");
  }

  return (
    <main className="mt-36 grid place-items-center container">
      <Suspense fallback={<div>Loading...</div>}>
        <Card className="border flex flex-col justify-between min-w-80 w-full max-w-2xl h-[70vh] min-h-[350px] max-h-[450px] relative">
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

          <div className="h-full flex pb-10 overflow-y-auto flex-col w-full py-10 px-5 sm:px-7 gap-4">
            <div className="flex gap-2 items-center">
              <Avatar>
                <AvatarImage className="rounded-full" src={user.imageUrl} />
                <AvatarFallback>
                  <ScanFace />
                </AvatarFallback>
              </Avatar>
              <div
                className={cn(
                  "flex w-max max-w-[75%] sm:max-w-[55%] flex-col gap-2 rounded-lg px-3 py-2 whitespace-pre-wrap bg-muted",
                )}
              >
                {user.question}
              </div>
            </div>

            <ChatForm
              userId={user.id}
              sessionId={session?.userId}
              question={user.question}
            />
          </div>
        </Card>
      </Suspense>
    </main>
  );
}
