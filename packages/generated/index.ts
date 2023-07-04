import { GraphQLClient } from 'graphql-request';
import { GraphQLClientRequestHeaders } from 'graphql-request/build/cjs/types';
import gql from 'graphql-tag';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  DateTime: { input: any; output: any; }
};

export type Mutation = {
  __typename?: 'Mutation';
  addReply: Scalars['String']['output'];
  changePassword: Scalars['String']['output'];
  createUser: Scalars['String']['output'];
  deleteMessage: Scalars['String']['output'];
  deleteUser: Scalars['String']['output'];
  editMessage: Scalars['String']['output'];
  editUserMessage: Scalars['String']['output'];
  editUsername: Scalars['String']['output'];
  sendMessage: Scalars['String']['output'];
};


export type MutationAddReplyArgs = {
  content: Scalars['String']['input'];
  id: Scalars['ID']['input'];
};


export type MutationChangePasswordArgs = {
  newPassword: Scalars['String']['input'];
};


export type MutationCreateUserArgs = {
  password: Scalars['String']['input'];
  username: Scalars['String']['input'];
};


export type MutationDeleteMessageArgs = {
  id: Scalars['ID']['input'];
};


export type MutationEditMessageArgs = {
  id: Scalars['ID']['input'];
  isOpened: Scalars['Boolean']['input'];
};


export type MutationEditUserMessageArgs = {
  message: Scalars['String']['input'];
};


export type MutationEditUsernameArgs = {
  username: Scalars['String']['input'];
};


export type MutationSendMessageArgs = {
  input: SendMessageInput;
};

export type Query = {
  __typename?: 'Query';
  getRecentMessages?: Maybe<Array<RecentMessage>>;
  getSeenMessages?: Maybe<Array<SeenMessage>>;
  getSentMessages?: Maybe<Array<SentMessage>>;
  getUser?: Maybe<User>;
  hello: Scalars['String']['output'];
};


export type QueryGetRecentMessagesArgs = {
  cursorId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryGetSeenMessagesArgs = {
  cursorId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryGetSentMessagesArgs = {
  cursorId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryGetUserArgs = {
  type: Scalars['String']['input'];
  user: Scalars['String']['input'];
};

export type RecentMessage = {
  __typename?: 'RecentMessage';
  clue?: Maybe<Scalars['String']['output']>;
  content: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  receiverMsg: Scalars['String']['output'];
};

export type SeenMessage = {
  __typename?: 'SeenMessage';
  clue?: Maybe<Scalars['String']['output']>;
  content: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  receiverMsg: Scalars['String']['output'];
  reply?: Maybe<Scalars['String']['output']>;
};

export type SendMessageInput = {
  clue?: InputMaybe<Scalars['String']['input']>;
  content: Scalars['String']['input'];
  receiverMsg: Scalars['String']['input'];
  receiverUsername: Scalars['String']['input'];
};

export type SentMessage = {
  __typename?: 'SentMessage';
  clue?: Maybe<Scalars['String']['output']>;
  content: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['ID']['output'];
  receiverMsg: Scalars['String']['output'];
  receiverUsername?: Maybe<Scalars['String']['output']>;
  reply?: Maybe<Scalars['String']['output']>;
};

export type User = {
  __typename?: 'User';
  email?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  image?: Maybe<Scalars['String']['output']>;
  message: Scalars['String']['output'];
  name?: Maybe<Scalars['String']['output']>;
  password?: Maybe<Scalars['String']['output']>;
  username?: Maybe<Scalars['String']['output']>;
};

export type GetRecentMessagesQueryVariables = Exact<{
  cursorId?: InputMaybe<Scalars['ID']['input']>;
}>;


export type GetRecentMessagesQuery = { __typename?: 'Query', getRecentMessages?: Array<{ __typename?: 'RecentMessage', id: string, clue?: string | null, content: string, createdAt: any, receiverMsg: string }> | null };

export type GetSeenMessagesQueryVariables = Exact<{
  cursorId?: InputMaybe<Scalars['ID']['input']>;
}>;


export type GetSeenMessagesQuery = { __typename?: 'Query', getSeenMessages?: Array<{ __typename?: 'SeenMessage', id: string, clue?: string | null, reply?: string | null, content: string, createdAt: any, receiverMsg: string }> | null };

export type GetSentMessagesQueryVariables = Exact<{
  cursorId?: InputMaybe<Scalars['ID']['input']>;
}>;


export type GetSentMessagesQuery = { __typename?: 'Query', getSentMessages?: Array<{ __typename?: 'SentMessage', id: string, clue?: string | null, reply?: string | null, content: string, createdAt: any, receiverMsg: string, receiverUsername?: string | null }> | null };

export type EditMessageMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  isOpened: Scalars['Boolean']['input'];
}>;


export type EditMessageMutation = { __typename?: 'Mutation', editMessage: string };

export type DeleteMessageMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteMessageMutation = { __typename?: 'Mutation', deleteMessage: string };

export type SendMessageMutationVariables = Exact<{
  input: SendMessageInput;
}>;


export type SendMessageMutation = { __typename?: 'Mutation', sendMessage: string };

export type AddReplyMutationVariables = Exact<{
  id: Scalars['ID']['input'];
  content: Scalars['String']['input'];
}>;


export type AddReplyMutation = { __typename?: 'Mutation', addReply: string };

export type GetUserQueryVariables = Exact<{
  user: Scalars['String']['input'];
  type: Scalars['String']['input'];
}>;


export type GetUserQuery = { __typename?: 'Query', getUser?: { __typename?: 'User', id: string, image?: string | null, email?: string | null, message: string, username?: string | null, password?: string | null } | null };

export type CreateUserMutationVariables = Exact<{
  username: Scalars['String']['input'];
  password: Scalars['String']['input'];
}>;


export type CreateUserMutation = { __typename?: 'Mutation', createUser: string };

export type EditUsernameMutationVariables = Exact<{
  username: Scalars['String']['input'];
}>;


export type EditUsernameMutation = { __typename?: 'Mutation', editUsername: string };

export type EditUserMessageMutationVariables = Exact<{
  message: Scalars['String']['input'];
}>;


export type EditUserMessageMutation = { __typename?: 'Mutation', editUserMessage: string };

export type ChangePasswordMutationVariables = Exact<{
  newPassword: Scalars['String']['input'];
}>;


export type ChangePasswordMutation = { __typename?: 'Mutation', changePassword: string };

export type DeleteUserMutationVariables = Exact<{ [key: string]: never; }>;


export type DeleteUserMutation = { __typename?: 'Mutation', deleteUser: string };


export const GetRecentMessagesDocument = gql`
    query getRecentMessages($cursorId: ID) {
  getRecentMessages(cursorId: $cursorId) {
    id
    clue
    content
    createdAt
    receiverMsg
  }
}
    `;
export const GetSeenMessagesDocument = gql`
    query getSeenMessages($cursorId: ID) {
  getSeenMessages(cursorId: $cursorId) {
    id
    clue
    reply
    content
    createdAt
    receiverMsg
  }
}
    `;
export const GetSentMessagesDocument = gql`
    query getSentMessages($cursorId: ID) {
  getSentMessages(cursorId: $cursorId) {
    id
    clue
    reply
    content
    createdAt
    receiverMsg
    receiverUsername
  }
}
    `;
export const EditMessageDocument = gql`
    mutation editMessage($id: ID!, $isOpened: Boolean!) {
  editMessage(id: $id, isOpened: $isOpened)
}
    `;
export const DeleteMessageDocument = gql`
    mutation deleteMessage($id: ID!) {
  deleteMessage(id: $id)
}
    `;
export const SendMessageDocument = gql`
    mutation sendMessage($input: SendMessageInput!) {
  sendMessage(input: $input)
}
    `;
export const AddReplyDocument = gql`
    mutation addReply($id: ID!, $content: String!) {
  addReply(id: $id, content: $content)
}
    `;
export const GetUserDocument = gql`
    query getUser($user: String!, $type: String!) {
  getUser(user: $user, type: $type) {
    id
    image
    email
    message
    username
    password
  }
}
    `;
export const CreateUserDocument = gql`
    mutation createUser($username: String!, $password: String!) {
  createUser(username: $username, password: $password)
}
    `;
export const EditUsernameDocument = gql`
    mutation editUsername($username: String!) {
  editUsername(username: $username)
}
    `;
export const EditUserMessageDocument = gql`
    mutation editUserMessage($message: String!) {
  editUserMessage(message: $message)
}
    `;
export const ChangePasswordDocument = gql`
    mutation changePassword($newPassword: String!) {
  changePassword(newPassword: $newPassword)
}
    `;
export const DeleteUserDocument = gql`
    mutation deleteUser {
  deleteUser
}
    `;

export type SdkFunctionWrapper = <T>(action: (requestHeaders?:Record<string, string>) => Promise<T>, operationName: string, operationType?: string) => Promise<T>;


const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType) => action();

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    getRecentMessages(variables?: GetRecentMessagesQueryVariables, requestHeaders?: GraphQLClientRequestHeaders): Promise<GetRecentMessagesQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetRecentMessagesQuery>(GetRecentMessagesDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getRecentMessages', 'query');
    },
    getSeenMessages(variables?: GetSeenMessagesQueryVariables, requestHeaders?: GraphQLClientRequestHeaders): Promise<GetSeenMessagesQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetSeenMessagesQuery>(GetSeenMessagesDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getSeenMessages', 'query');
    },
    getSentMessages(variables?: GetSentMessagesQueryVariables, requestHeaders?: GraphQLClientRequestHeaders): Promise<GetSentMessagesQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetSentMessagesQuery>(GetSentMessagesDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getSentMessages', 'query');
    },
    editMessage(variables: EditMessageMutationVariables, requestHeaders?: GraphQLClientRequestHeaders): Promise<EditMessageMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<EditMessageMutation>(EditMessageDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'editMessage', 'mutation');
    },
    deleteMessage(variables: DeleteMessageMutationVariables, requestHeaders?: GraphQLClientRequestHeaders): Promise<DeleteMessageMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<DeleteMessageMutation>(DeleteMessageDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'deleteMessage', 'mutation');
    },
    sendMessage(variables: SendMessageMutationVariables, requestHeaders?: GraphQLClientRequestHeaders): Promise<SendMessageMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<SendMessageMutation>(SendMessageDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'sendMessage', 'mutation');
    },
    addReply(variables: AddReplyMutationVariables, requestHeaders?: GraphQLClientRequestHeaders): Promise<AddReplyMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<AddReplyMutation>(AddReplyDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'addReply', 'mutation');
    },
    getUser(variables: GetUserQueryVariables, requestHeaders?: GraphQLClientRequestHeaders): Promise<GetUserQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetUserQuery>(GetUserDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getUser', 'query');
    },
    createUser(variables: CreateUserMutationVariables, requestHeaders?: GraphQLClientRequestHeaders): Promise<CreateUserMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<CreateUserMutation>(CreateUserDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'createUser', 'mutation');
    },
    editUsername(variables: EditUsernameMutationVariables, requestHeaders?: GraphQLClientRequestHeaders): Promise<EditUsernameMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<EditUsernameMutation>(EditUsernameDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'editUsername', 'mutation');
    },
    editUserMessage(variables: EditUserMessageMutationVariables, requestHeaders?: GraphQLClientRequestHeaders): Promise<EditUserMessageMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<EditUserMessageMutation>(EditUserMessageDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'editUserMessage', 'mutation');
    },
    changePassword(variables: ChangePasswordMutationVariables, requestHeaders?: GraphQLClientRequestHeaders): Promise<ChangePasswordMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<ChangePasswordMutation>(ChangePasswordDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'changePassword', 'mutation');
    },
    deleteUser(variables?: DeleteUserMutationVariables, requestHeaders?: GraphQLClientRequestHeaders): Promise<DeleteUserMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<DeleteUserMutation>(DeleteUserDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'deleteUser', 'mutation');
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;