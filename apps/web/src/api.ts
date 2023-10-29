import { GraphQLClient } from 'graphql-request';
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
  getManyMessages,
  getSentMessages,
  getRecentMessages,
  getGlobalMessages,
  sendGlobalMessage,
} = getSdk(gqlClient);
