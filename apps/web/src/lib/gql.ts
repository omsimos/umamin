import { graphql } from "gql.tada";
import { ResultOf } from "gql.tada";
import { registerUrql } from "@urql/next/rsc";
import { cacheExchange, createClient, fetchExchange } from "urql/core";

const makeClient = () => {
  return createClient({
    url: process.env.NEXT_PUBLIC_GQL_URL!,
    exchanges: [cacheExchange, fetchExchange],
    fetchOptions: { cache: "no-store" },
  });
};

export const { getClient } = registerUrql(makeClient);

export const GetUserByUsernameQuery = graphql(`
  query GetUserByUsername($username: String!) {
    getUserByUsername(username: $username) {
      id
      username
      imageUrl
      createdAt
    }
  }
`);

export type GetUserByUsernameResult = ResultOf<
  typeof GetUserByUsernameQuery
>["getUserByUsername"];
