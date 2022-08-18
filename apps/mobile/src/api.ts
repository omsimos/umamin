import { GraphQLClient } from 'graphql-request';
import { QueryClient } from 'react-query';
import { getSdk } from '@umamin/generated';

/**
 * Temporary. should come from env.
 */
const GQL_ENDPOINT = 'https://umamin.link/api/graphql';

const gqlClient = new GraphQLClient(GQL_ENDPOINT);
export const { getUser } = getSdk(gqlClient);

export const queryClient = new QueryClient();
