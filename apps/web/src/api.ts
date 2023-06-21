import { GraphQLClient } from 'graphql-request';
import { QueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { getSdk } from '@umamin/generated';

const gqlClient = new GraphQLClient(process.env.NEXT_PUBLIC_GQL_ENDPOINT ?? '');
export const {
  getUser,
  addReply,
  createUser,
  deleteUser,
  sendMessage,
  editMessage,
  editUsername,
  deleteMessage,
  changePassword,
  editUserMessage,
  getSeenMessages,
  getSentMessages,
  getRecentMessages,
} = getSdk(gqlClient);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      onError: (err: any) => {
        if (err.response?.errors.length) {
          toast.error(err.response.errors[0].message);
        } else {
          toast.error(err.message);
        }
      },
    },
    mutations: {
      onError: (err: any) => {
        if (err.response?.errors.length) {
          toast.error(err.response.errors[0].message);
        } else {
          toast.error(err.message);
        }
      },
    },
  },
});
