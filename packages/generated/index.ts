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
  DateTimeISO: { input: any; output: any; }
};

export type ErrorResponse = {
  __typename?: 'ErrorResponse';
  error?: Maybe<Scalars['String']['output']>;
};

export type GlobalMessage = {
  __typename?: 'GlobalMessage';
  content: Scalars['String']['output'];
  createdAt: Scalars['DateTimeISO']['output'];
  id: Scalars['ID']['output'];
  isAnonymous: Scalars['Boolean']['output'];
  updatedAt: Scalars['DateTimeISO']['output'];
  user?: Maybe<GlobalMessageUser>;
};

export type GlobalMessageUser = {
  __typename?: 'GlobalMessageUser';
  id: Scalars['ID']['output'];
  image?: Maybe<Scalars['String']['output']>;
  username?: Maybe<Scalars['String']['output']>;
};

export type GlobalMessagesData = {
  __typename?: 'GlobalMessagesData';
  cursorId?: Maybe<Scalars['String']['output']>;
  data: Array<GlobalMessage>;
};

export type Message = {
  __typename?: 'Message';
  clue?: Maybe<Scalars['String']['output']>;
  content: Scalars['String']['output'];
  createdAt: Scalars['DateTimeISO']['output'];
  id: Scalars['ID']['output'];
  receiverMsg: Scalars['String']['output'];
  receiverUsername?: Maybe<Scalars['String']['output']>;
  reply?: Maybe<Scalars['String']['output']>;
};

export type MessagesData = {
  __typename?: 'MessagesData';
  cursorId?: Maybe<Scalars['String']['output']>;
  data: Array<Message>;
};

export type Mutation = {
  __typename?: 'Mutation';
  addReply: Scalars['String']['output'];
  changePassword: ErrorResponse;
  createUser: ErrorResponse;
  deleteMessage: Scalars['String']['output'];
  deleteUser: ErrorResponse;
  editUserMessage: ErrorResponse;
  editUsername: ErrorResponse;
  sendGlobalMessage: SendGlobalMessage;
  sendMessage: Scalars['String']['output'];
};


export type MutationAddReplyArgs = {
  content: Scalars['String']['input'];
  id: Scalars['ID']['input'];
};


export type MutationChangePasswordArgs = {
  newPassword: Scalars['String']['input'];
  userId: Scalars['ID']['input'];
};


export type MutationCreateUserArgs = {
  password: Scalars['String']['input'];
  username: Scalars['String']['input'];
};


export type MutationDeleteMessageArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteUserArgs = {
  userId: Scalars['ID']['input'];
};


export type MutationEditUserMessageArgs = {
  message: Scalars['String']['input'];
  userId: Scalars['ID']['input'];
};


export type MutationEditUsernameArgs = {
  userId: Scalars['ID']['input'];
  username: Scalars['String']['input'];
};


export type MutationSendGlobalMessageArgs = {
  input: SendGlobalMessageInput;
};


export type MutationSendMessageArgs = {
  input: SendMessageInput;
};

export type Query = {
  __typename?: 'Query';
  getGlobalMessages?: Maybe<GlobalMessagesData>;
  getMessages?: Maybe<MessagesData>;
  getUser?: Maybe<User>;
  hello: ErrorResponse;
};


export type QueryGetGlobalMessagesArgs = {
  cursorId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryGetMessagesArgs = {
  cursorId?: InputMaybe<Scalars['ID']['input']>;
  type: Scalars['String']['input'];
  userId: Scalars['ID']['input'];
};


export type QueryGetUserArgs = {
  type: Scalars['String']['input'];
  user: Scalars['String']['input'];
};

export type SendGlobalMessage = {
  __typename?: 'SendGlobalMessage';
  data?: Maybe<GlobalMessage>;
  error?: Maybe<Scalars['String']['output']>;
};

export type SendGlobalMessageInput = {
  content: Scalars['String']['input'];
  isAnonymous: Scalars['Boolean']['input'];
  userId: Scalars['ID']['input'];
};

export type SendMessageInput = {
  clue?: InputMaybe<Scalars['String']['input']>;
  content: Scalars['String']['input'];
  receiverMsg: Scalars['String']['input'];
  receiverUsername: Scalars['String']['input'];
  userId: Scalars['ID']['input'];
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

export type GetGlobalMessagesQueryVariables = Exact<{
  cursorId?: InputMaybe<Scalars['ID']['input']>;
}>;


export type GetGlobalMessagesQuery = { __typename?: 'Query', getGlobalMessages?: { __typename?: 'GlobalMessagesData', cursorId?: string | null, data: Array<{ __typename?: 'GlobalMessage', id: string, content: string, createdAt: any, updatedAt: any, isAnonymous: boolean, user?: { __typename?: 'GlobalMessageUser', id: string, username?: string | null, image?: string | null } | null }> } | null };

export type GetMessagesQueryVariables = Exact<{
  type: Scalars['String']['input'];
  userId: Scalars['ID']['input'];
  cursorId?: InputMaybe<Scalars['ID']['input']>;
}>;


export type GetMessagesQuery = { __typename?: 'Query', getMessages?: { __typename?: 'MessagesData', cursorId?: string | null, data: Array<{ __typename?: 'Message', id: string, clue?: string | null, reply?: string | null, content: string, createdAt: any, receiverMsg: string, receiverUsername?: string | null }> } | null };

export type DeleteMessageMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type DeleteMessageMutation = { __typename?: 'Mutation', deleteMessage: string };

export type SendMessageMutationVariables = Exact<{
  input: SendMessageInput;
}>;


export type SendMessageMutation = { __typename?: 'Mutation', sendMessage: string };

export type SendGlobalMessageMutationVariables = Exact<{
  input: SendGlobalMessageInput;
}>;


export type SendGlobalMessageMutation = { __typename?: 'Mutation', sendGlobalMessage: { __typename?: 'SendGlobalMessage', error?: string | null, data?: { __typename?: 'GlobalMessage', id: string, content: string, createdAt: any, updatedAt: any, isAnonymous: boolean, user?: { __typename?: 'GlobalMessageUser', id: string, username?: string | null, image?: string | null } | null } | null } };

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


export type CreateUserMutation = { __typename?: 'Mutation', createUser: { __typename?: 'ErrorResponse', error?: string | null } };

export type EditUsernameMutationVariables = Exact<{
  userId: Scalars['ID']['input'];
  username: Scalars['String']['input'];
}>;


export type EditUsernameMutation = { __typename?: 'Mutation', editUsername: { __typename?: 'ErrorResponse', error?: string | null } };

export type EditUserMessageMutationVariables = Exact<{
  userId: Scalars['ID']['input'];
  message: Scalars['String']['input'];
}>;


export type EditUserMessageMutation = { __typename?: 'Mutation', editUserMessage: { __typename?: 'ErrorResponse', error?: string | null } };

export type ChangePasswordMutationVariables = Exact<{
  userId: Scalars['ID']['input'];
  newPassword: Scalars['String']['input'];
}>;


export type ChangePasswordMutation = { __typename?: 'Mutation', changePassword: { __typename?: 'ErrorResponse', error?: string | null } };

export type DeleteUserMutationVariables = Exact<{
  userId: Scalars['ID']['input'];
}>;


export type DeleteUserMutation = { __typename?: 'Mutation', deleteUser: { __typename?: 'ErrorResponse', error?: string | null } };


export const GetGlobalMessagesDocument = gql`
    query getGlobalMessages($cursorId: ID) {
  getGlobalMessages(cursorId: $cursorId) {
    data {
      id
      content
      createdAt
      updatedAt
      isAnonymous
      user {
        id
        username
        image
      }
    }
    cursorId
  }
}
    `;
export const GetMessagesDocument = gql`
    query getMessages($type: String!, $userId: ID!, $cursorId: ID) {
  getMessages(type: $type, userId: $userId, cursorId: $cursorId) {
    data {
      id
      clue
      reply
      content
      createdAt
      receiverMsg
      receiverUsername
    }
    cursorId
  }
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
export const SendGlobalMessageDocument = gql`
    mutation sendGlobalMessage($input: SendGlobalMessageInput!) {
  sendGlobalMessage(input: $input) {
    data {
      id
      content
      createdAt
      updatedAt
      isAnonymous
      user {
        id
        username
        image
      }
    }
    error
  }
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
  createUser(username: $username, password: $password) {
    error
  }
}
    `;
export const EditUsernameDocument = gql`
    mutation editUsername($userId: ID!, $username: String!) {
  editUsername(userId: $userId, username: $username) {
    error
  }
}
    `;
export const EditUserMessageDocument = gql`
    mutation editUserMessage($userId: ID!, $message: String!) {
  editUserMessage(userId: $userId, message: $message) {
    error
  }
}
    `;
export const ChangePasswordDocument = gql`
    mutation changePassword($userId: ID!, $newPassword: String!) {
  changePassword(userId: $userId, newPassword: $newPassword) {
    error
  }
}
    `;
export const DeleteUserDocument = gql`
    mutation deleteUser($userId: ID!) {
  deleteUser(userId: $userId) {
    error
  }
}
    `;

export type SdkFunctionWrapper = <T>(action: (requestHeaders?:Record<string, string>) => Promise<T>, operationName: string, operationType?: string) => Promise<T>;


const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType) => action();

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    getGlobalMessages(variables?: GetGlobalMessagesQueryVariables, requestHeaders?: GraphQLClientRequestHeaders): Promise<GetGlobalMessagesQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetGlobalMessagesQuery>(GetGlobalMessagesDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getGlobalMessages', 'query');
    },
    getMessages(variables: GetMessagesQueryVariables, requestHeaders?: GraphQLClientRequestHeaders): Promise<GetMessagesQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetMessagesQuery>(GetMessagesDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getMessages', 'query');
    },
    deleteMessage(variables: DeleteMessageMutationVariables, requestHeaders?: GraphQLClientRequestHeaders): Promise<DeleteMessageMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<DeleteMessageMutation>(DeleteMessageDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'deleteMessage', 'mutation');
    },
    sendMessage(variables: SendMessageMutationVariables, requestHeaders?: GraphQLClientRequestHeaders): Promise<SendMessageMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<SendMessageMutation>(SendMessageDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'sendMessage', 'mutation');
    },
    sendGlobalMessage(variables: SendGlobalMessageMutationVariables, requestHeaders?: GraphQLClientRequestHeaders): Promise<SendGlobalMessageMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<SendGlobalMessageMutation>(SendGlobalMessageDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'sendGlobalMessage', 'mutation');
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
    deleteUser(variables: DeleteUserMutationVariables, requestHeaders?: GraphQLClientRequestHeaders): Promise<DeleteUserMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<DeleteUserMutation>(DeleteUserDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'deleteUser', 'mutation');
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;