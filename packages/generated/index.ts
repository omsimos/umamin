import { GraphQLClient } from 'graphql-request';
import * as Dom from 'graphql-request/dist/types.dom';
import gql from 'graphql-tag';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
  DateTime: any;
};

export type Mutation = {
  __typename?: 'Mutation';
  addReply: Scalars['String'];
  changePassword: Scalars['String'];
  createUser: Scalars['String'];
  deleteMessage: Scalars['String'];
  deleteUser: Scalars['String'];
  editMessage: Scalars['String'];
  editUserMessage: Scalars['String'];
  editUsername: Scalars['String'];
  sendMessage: Scalars['String'];
};


export type MutationAddReplyArgs = {
  content: Scalars['String'];
  id: Scalars['ID'];
};


export type MutationChangePasswordArgs = {
  newPassword: Scalars['String'];
};


export type MutationCreateUserArgs = {
  password: Scalars['String'];
  username: Scalars['String'];
};


export type MutationDeleteMessageArgs = {
  id: Scalars['ID'];
};


export type MutationEditMessageArgs = {
  id: Scalars['ID'];
  isOpened: Scalars['Boolean'];
};


export type MutationEditUserMessageArgs = {
  message: Scalars['String'];
};


export type MutationEditUsernameArgs = {
  username: Scalars['String'];
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
};


export type QueryGetRecentMessagesArgs = {
  cursorId?: InputMaybe<Scalars['ID']>;
};


export type QueryGetSeenMessagesArgs = {
  cursorId?: InputMaybe<Scalars['ID']>;
};


export type QueryGetSentMessagesArgs = {
  cursorId?: InputMaybe<Scalars['ID']>;
};


export type QueryGetUserArgs = {
  type: Scalars['String'];
  user: Scalars['String'];
};

export type RecentMessage = {
  __typename?: 'RecentMessage';
  clue?: Maybe<Scalars['String']>;
  content: Scalars['String'];
  createdAt: Scalars['DateTime'];
  id: Scalars['ID'];
  receiverMsg: Scalars['String'];
};

export type SeenMessage = {
  __typename?: 'SeenMessage';
  clue?: Maybe<Scalars['String']>;
  content: Scalars['String'];
  createdAt: Scalars['DateTime'];
  id: Scalars['ID'];
  receiverMsg: Scalars['String'];
  reply?: Maybe<Scalars['String']>;
};

export type SendMessageInput = {
  clue?: InputMaybe<Scalars['String']>;
  content: Scalars['String'];
  receiverMsg: Scalars['String'];
  receiverUsername: Scalars['String'];
};

export type SentMessage = {
  __typename?: 'SentMessage';
  clue?: Maybe<Scalars['String']>;
  content: Scalars['String'];
  createdAt: Scalars['DateTime'];
  id: Scalars['ID'];
  receiverMsg: Scalars['String'];
  receiverUsername?: Maybe<Scalars['String']>;
  reply?: Maybe<Scalars['String']>;
};

export type User = {
  __typename?: 'User';
  email?: Maybe<Scalars['String']>;
  id: Scalars['ID'];
  image?: Maybe<Scalars['String']>;
  message: Scalars['String'];
  name?: Maybe<Scalars['String']>;
  password?: Maybe<Scalars['String']>;
  username?: Maybe<Scalars['String']>;
};

export type GetRecentMessagesQueryVariables = Exact<{
  cursorId?: InputMaybe<Scalars['ID']>;
}>;


export type GetRecentMessagesQuery = { __typename?: 'Query', getRecentMessages?: Array<{ __typename?: 'RecentMessage', id: string, clue?: string | null, content: string, createdAt: any, receiverMsg: string }> | null };

export type GetSeenMessagesQueryVariables = Exact<{
  cursorId?: InputMaybe<Scalars['ID']>;
}>;


export type GetSeenMessagesQuery = { __typename?: 'Query', getSeenMessages?: Array<{ __typename?: 'SeenMessage', id: string, clue?: string | null, reply?: string | null, content: string, createdAt: any, receiverMsg: string }> | null };

export type GetSentMessagesQueryVariables = Exact<{
  cursorId?: InputMaybe<Scalars['ID']>;
}>;


export type GetSentMessagesQuery = { __typename?: 'Query', getSentMessages?: Array<{ __typename?: 'SentMessage', id: string, clue?: string | null, reply?: string | null, content: string, createdAt: any, receiverMsg: string, receiverUsername?: string | null }> | null };

export type EditMessageMutationVariables = Exact<{
  id: Scalars['ID'];
  isOpened: Scalars['Boolean'];
}>;


export type EditMessageMutation = { __typename?: 'Mutation', editMessage: string };

export type DeleteMessageMutationVariables = Exact<{
  id: Scalars['ID'];
}>;


export type DeleteMessageMutation = { __typename?: 'Mutation', deleteMessage: string };

export type SendMessageMutationVariables = Exact<{
  input: SendMessageInput;
}>;


export type SendMessageMutation = { __typename?: 'Mutation', sendMessage: string };

export type AddReplyMutationVariables = Exact<{
  id: Scalars['ID'];
  content: Scalars['String'];
}>;


export type AddReplyMutation = { __typename?: 'Mutation', addReply: string };

export type GetUserQueryVariables = Exact<{
  user: Scalars['String'];
  type: Scalars['String'];
}>;


export type GetUserQuery = { __typename?: 'Query', getUser?: { __typename?: 'User', id: string, image?: string | null, email?: string | null, message: string, username?: string | null, password?: string | null } | null };

export type CreateUserMutationVariables = Exact<{
  username: Scalars['String'];
  password: Scalars['String'];
}>;


export type CreateUserMutation = { __typename?: 'Mutation', createUser: string };

export type EditUsernameMutationVariables = Exact<{
  username: Scalars['String'];
}>;


export type EditUsernameMutation = { __typename?: 'Mutation', editUsername: string };

export type EditUserMessageMutationVariables = Exact<{
  message: Scalars['String'];
}>;


export type EditUserMessageMutation = { __typename?: 'Mutation', editUserMessage: string };

export type ChangePasswordMutationVariables = Exact<{
  newPassword: Scalars['String'];
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
    getRecentMessages(variables?: GetRecentMessagesQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<GetRecentMessagesQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetRecentMessagesQuery>(GetRecentMessagesDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getRecentMessages', 'query');
    },
    getSeenMessages(variables?: GetSeenMessagesQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<GetSeenMessagesQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetSeenMessagesQuery>(GetSeenMessagesDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getSeenMessages', 'query');
    },
    getSentMessages(variables?: GetSentMessagesQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<GetSentMessagesQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetSentMessagesQuery>(GetSentMessagesDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getSentMessages', 'query');
    },
    editMessage(variables: EditMessageMutationVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<EditMessageMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<EditMessageMutation>(EditMessageDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'editMessage', 'mutation');
    },
    deleteMessage(variables: DeleteMessageMutationVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<DeleteMessageMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<DeleteMessageMutation>(DeleteMessageDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'deleteMessage', 'mutation');
    },
    sendMessage(variables: SendMessageMutationVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<SendMessageMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<SendMessageMutation>(SendMessageDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'sendMessage', 'mutation');
    },
    addReply(variables: AddReplyMutationVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<AddReplyMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<AddReplyMutation>(AddReplyDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'addReply', 'mutation');
    },
    getUser(variables: GetUserQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<GetUserQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetUserQuery>(GetUserDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getUser', 'query');
    },
    createUser(variables: CreateUserMutationVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<CreateUserMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<CreateUserMutation>(CreateUserDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'createUser', 'mutation');
    },
    editUsername(variables: EditUsernameMutationVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<EditUsernameMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<EditUsernameMutation>(EditUsernameDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'editUsername', 'mutation');
    },
    editUserMessage(variables: EditUserMessageMutationVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<EditUserMessageMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<EditUserMessageMutation>(EditUserMessageDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'editUserMessage', 'mutation');
    },
    changePassword(variables: ChangePasswordMutationVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<ChangePasswordMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<ChangePasswordMutation>(ChangePasswordDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'changePassword', 'mutation');
    },
    deleteUser(variables?: DeleteUserMutationVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<DeleteUserMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<DeleteUserMutation>(DeleteUserDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'deleteUser', 'mutation');
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;