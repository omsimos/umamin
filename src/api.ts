import { GraphQLClient } from 'graphql-request';
import { QueryClient } from 'react-query';
import toast from 'react-hot-toast';

import { getSdk } from './generated/graphql';

const gqlClient = new GraphQLClient(process.env.NEXT_PUBLIC_GQL_ENDPOINT ?? '');
export const {
  getUser,
  createUser,
  editUser,
  getMessageById,
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
} = getSdk(gqlClient);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      onError: (err: any) => {
        toast.error(err.response.errors[0].message);
      },
    },
    mutations: {
      onError: (err: any) => {
        toast.error(err.response.errors[0].message);
      },
    },
  },
});
