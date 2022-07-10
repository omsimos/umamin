/* eslint-disable no-console */
import { GraphQLClient } from 'graphql-request';
import { QueryClient } from 'react-query';

import { getSdk } from './generated/graphql';

const gqlClient = new GraphQLClient(process.env.NEXT_PUBLIC_GQL_ENDPOINT ?? '');
export const { getUser, createUser } = getSdk(gqlClient);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      onError: (err) => {
        /**
         * handle toast here. i usually user [react-hot-toast](https://react-hot-toast.com/)
         * e.g. toast.error(err.message);
         * errors here will come from graphql resolvers
         */
        console.error(err);
      },
    },
    mutations: {
      onError: (err) => {
        // handle toast here as well
        console.error(err);
      },
    },
  },
});
