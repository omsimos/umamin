import { cache } from "react";
import getClient from "@/lib/gql/rsc";
import { ResultOf, graphql } from "gql.tada";

export const USER_BY_USERNAME_QUERY = graphql(`
  query UserByUsername($username: String!) {
    userByUsername(username: $username) {
      __typename
      id
      bio
      question
      username
      displayName
      question
      quietMode
      imageUrl
      createdAt
    }
  }
`);

const userByUsernamePersisted = graphql.persisted(
  "e56708c4cacdba6c698de1f4bc45a999ca535fb519bd806caf9a62a6582159e4",
  USER_BY_USERNAME_QUERY,
);

export const getUserByUsername = cache(async (username: string) => {
  const result = await getClient().query(userByUsernamePersisted, {
    username,
  });

  return result.data?.userByUsername;
});

export type UserByUsernameQueryResult = ResultOf<
  typeof USER_BY_USERNAME_QUERY
>["userByUsername"];
