import { GraphQLClient } from 'graphql-request';
import { getSdk } from '@umamin/generated';

const gqlClient = new GraphQLClient(process.env.NEXT_PUBLIC_GQL_ENDPOINT ?? '');
export const {
  getUser,
  addReply,
  createUser,
  deleteUser,
  sendMessage,
  getMessages,
  editUsername,
  deleteMessage,
  changePassword,
  editUserMessage,
  getGlobalMessages,
  sendGlobalMessage,
} = getSdk(gqlClient);
