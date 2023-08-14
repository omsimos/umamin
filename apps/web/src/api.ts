import { GraphQLClient } from 'graphql-request';
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { getSdk } from '@umamin/generated';
import toast from 'react-hot-toast';

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
  getGlobalMessages,
  sendGlobalMessage,
} = getSdk(gqlClient);

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (err: any) => {
      if (err.response?.errors.length) {
        toast.error(err.response.errors[0].message);
      } else {
        toast.error(err.message);
      }
    },
  }),

  mutationCache: new MutationCache({
    onError: (err: any) => {
      if (err.response?.errors.length) {
        toast.error(err.response.errors[0].message);
      } else {
        toast.error(err.message);
      }
    },
  }),
  defaultOptions: {
    queries: {
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});
