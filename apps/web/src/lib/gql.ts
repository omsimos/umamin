import { graphql } from "gql.tada";
import { ResultOf } from "gql.tada";
import { registerUrql } from "@urql/next/rsc";
import { cacheExchange, createClient, fetchExchange } from "urql/core";

const origin = process.env.NEXT_PUBLIC_VERCEL_URL;

const makeClient = () => {
  return createClient({
    url: origin
      ? `https://${origin}/api/graphql`
      : "http://localhost:3000/api/graphql",
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
