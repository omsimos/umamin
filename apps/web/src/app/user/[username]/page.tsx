import Link from "next/link";
import { cache } from "react";
import { graphql } from "gql.tada";
import { redirect } from "next/navigation";
import { MessageSquareMore, UserPlus } from "lucide-react";

import { getClient } from "@/lib/gql/rsc";
import { cn } from "@umamin/ui/lib/utils";
import { UserCard } from "@/app/components/user-card";
import { Button, buttonVariants } from "@umamin/ui/components/button";

const USER_BY_USERNAME_QUERY = graphql(`
  query UserByUsername($username: String!) {
    userByUsername(username: $username) {
      __typename
      id
      bio
      username
      displayName
      imageUrl
      createdAt
      quietMode
    }
  }
`);

export async function generateMetadata({
  params,
}: {
  params: { username: string };
}) {
  const username = params.username.startsWith("%40")
    ? params.username.split("%40").at(1)
    : params.username;
  const title = params.username
    ? `(@${username}) on Umamin`
    : // TODO: Check if user exists
      "User not found | Umamin";

  return {
    title: title,
  };
}

const getUser = cache(async (username: string) => {
  const res = await getClient().query(USER_BY_USERNAME_QUERY, {
    username,
  });

  return res;
});

export default async function Page({
  params,
}: {
  params: { username: string };
}) {
  const result = await getUser(params.username);
  const user = result.data?.userByUsername;

  if (!user) {
    redirect("/404");
  }

  return (
    <section className="container max-w-xl lg:mt-36 mt-28">
      <UserCard {...user} />

      <div className="flex gap-2 mt-6">
        <Button variant="outline" className="w-full" disabled>
          <UserPlus className="h-4 w-4 mr-2" />
          Follow
        </Button>

        <Link
          href={`/to/${params.username}`}
          className={cn(buttonVariants({ variant: "outline" }), "w-full")}
        >
          <MessageSquareMore className="h-4 w-4 mr-2" />
          Message
        </Link>
      </div>
    </section>
  );
}
