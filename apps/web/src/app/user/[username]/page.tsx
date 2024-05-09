import { graphql } from "gql.tada";
import { redirect } from "next/navigation";

import { getClient } from "@/lib/gql";
import { UserCard } from "@/app/components/user-card";

const USER_BY_USERNAME_QUERY = graphql(`
  query UserByUsername($username: String!) {
    userByUsername(username: $username) {
      __typename
      id
      bio
      username
      imageUrl
      createdAt
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

export default async function Page({
  params,
}: {
  params: { username: string };
}) {
  const result = await getClient().query(USER_BY_USERNAME_QUERY, {
    username: params.username,
  });

  const user = result.data?.userByUsername;

  if (!user) {
    redirect("/404");
  }

  return (
    <section className="container max-w-xl space-y-3 lg:mt-36 mt-28">
      <UserCard
        username={user.username}
        bio={user.bio}
        imageUrl={user.imageUrl}
        createdAt={user.createdAt}
      />
    </section>
  );
}
