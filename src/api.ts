import { GraphQLClient } from 'graphql-request';
import { QueryClient } from 'react-query';

import { getSdk } from './generated/graphql';

const gqlClient = new GraphQLClient(process.env.NEXT_PUBLIC_GQL_ENDPOINT ?? '');
export const { getUser } = getSdk(gqlClient);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});
