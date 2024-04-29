import { graphql } from "gql.tada";

import { redirect } from "next/navigation";
import { getClient } from "@/lib/gql-client";
import { ChatBox } from "@/app/components/chatbox";

const GetUserByUsernameQuery = graphql(`
  query GetUserByUsername($username: String!) {
    getUserByUsername(username: $username) {
      id
      username
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
  const result = await getClient().query(GetUserByUsernameQuery, {
    username: params.username,
  });

  const user = result.data?.getUserByUsername;

  if (!user) {
    redirect("/404");
  }

  return (
    <main className="mt-36 grid place-items-center container">
      <ChatBox
        username={user.username}
        imageUrl={user.imageUrl}
        createdAt={user.createdAt}
      />
    </main>
  );
}
