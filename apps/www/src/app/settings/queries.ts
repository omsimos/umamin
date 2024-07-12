import { cache } from "react";
import getClient from "@/lib/gql/rsc";
import { graphql, ResultOf } from "gql.tada";

export const CURRENT_USER_QUERY = graphql(`
  query CurrentUser {
    user {
      __typename
      id
      bio
      username
      displayName
      question
      quietMode
      imageUrl
      createdAt
      accounts {
        __typename
        id
        email
        picture
        createdAt
      }
    }
  }
`);

const currentUserPersisted = graphql.persisted(
  "sha256:3f2320bbe96bd7895f618b6cdedfdee5d2f40e3e0c1d75095ea0844a0ff107b4",
  CURRENT_USER_QUERY,
);

export const getCurrentUser = cache(async (sessionId?: string) => {
  const result = await getClient(sessionId).query(currentUserPersisted, {});

  return result?.data?.user;
});

export type CurrentUserResult = ResultOf<typeof CURRENT_USER_QUERY>["user"];
