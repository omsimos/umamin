import { GraphQLClient } from 'graphql-request';
import * as Dom from 'graphql-request/dist/types.dom';
import gql from 'graphql-tag';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = {
  [K in keyof T]: T[K];
};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]?: Maybe<T[SubKey]>;
};
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]: Maybe<T[SubKey]>;
};
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
};

export type Message = {
  __typename?: 'Message';
  content: Scalars['String'];
  id: Scalars['ID'];
  receiverId: Scalars['String'];
  senderId?: Maybe<Scalars['String']>;
};

export type Mutation = {
  __typename?: 'Mutation';
  createUser: Scalars['String'];
  deleteMessage: Scalars['String'];
  sendMessage: Message;
};

export type MutationCreateUserArgs = {
  password: Scalars['String'];
  username: Scalars['String'];
};

export type MutationDeleteMessageArgs = {
  id: Scalars['ID'];
};

export type MutationSendMessageArgs = {
  content: Scalars['String'];
  receiverUsername: Scalars['String'];
  senderUsername?: InputMaybe<Scalars['String']>;
};

export type Query = {
  __typename?: 'Query';
  message: Message;
  messages?: Maybe<Array<Message>>;
  user?: Maybe<User>;
};

export type QueryMessageArgs = {
  id: Scalars['ID'];
};

export type QueryMessagesArgs = {
  username: Scalars['String'];
};

export type QueryUserArgs = {
  username: Scalars['String'];
};

export type User = {
  __typename?: 'User';
  password: Scalars['String'];
  username: Scalars['String'];
};

export type CreateUserMutationVariables = Exact<{
  username: Scalars['String'];
  password: Scalars['String'];
}>;

export type CreateUserMutation = {
  __typename?: 'Mutation';
  createUser: string;
};

export type DeleteMessageMutationVariables = Exact<{
  id: Scalars['ID'];
}>;

export type DeleteMessageMutation = {
  __typename?: 'Mutation';
  deleteMessage: string;
};

export type GetMessageByIdQueryVariables = Exact<{
  id: Scalars['ID'];
}>;

export type GetMessageByIdQuery = {
  __typename?: 'Query';
  message: {
    __typename?: 'Message';
    id: string;
    content: string;
    senderId?: string | null;
    receiverId: string;
  };
};

export type GetMessagesQueryVariables = Exact<{
  username: Scalars['String'];
}>;

export type GetMessagesQuery = {
  __typename?: 'Query';
  messages?: Array<{
    __typename?: 'Message';
    id: string;
    content: string;
  }> | null;
};

export type GetUserQueryVariables = Exact<{
  username: Scalars['String'];
}>;

export type GetUserQuery = {
  __typename?: 'Query';
  user?: { __typename?: 'User'; username: string } | null;
};

export type SendMessageMutationVariables = Exact<{
  content: Scalars['String'];
  receiverUsername: Scalars['String'];
  senderUsername?: InputMaybe<Scalars['String']>;
}>;

export type SendMessageMutation = {
  __typename?: 'Mutation';
  sendMessage: { __typename?: 'Message'; id: string; content: string };
};

export const CreateUserDocument = gql`
  mutation createUser($username: String!, $password: String!) {
    createUser(username: $username, password: $password)
  }
`;
export const DeleteMessageDocument = gql`
  mutation deleteMessage($id: ID!) {
    deleteMessage(id: $id)
  }
`;
export const GetMessageByIdDocument = gql`
  query getMessageById($id: ID!) {
    message(id: $id) {
      id
      content
      senderId
      receiverId
    }
  }
`;
export const GetMessagesDocument = gql`
  query getMessages($username: String!) {
    messages(username: $username) {
      id
      content
    }
  }
`;
export const GetUserDocument = gql`
  query getUser($username: String!) {
    user(username: $username) {
      username
    }
  }
`;
export const SendMessageDocument = gql`
  mutation sendMessage(
    $content: String!
    $receiverUsername: String!
    $senderUsername: String
  ) {
    sendMessage(
      content: $content
      receiverUsername: $receiverUsername
      senderUsername: $senderUsername
    ) {
      id
      content
    }
  }
`;

export type SdkFunctionWrapper = <T>(
  action: (requestHeaders?: Record<string, string>) => Promise<T>,
  operationName: string,
  operationType?: string
) => Promise<T>;

const defaultWrapper: SdkFunctionWrapper = (
  action,
  _operationName,
  _operationType
) => action();

export function getSdk(
  client: GraphQLClient,
  withWrapper: SdkFunctionWrapper = defaultWrapper
) {
  return {
    createUser(
      variables: CreateUserMutationVariables,
      requestHeaders?: Dom.RequestInit['headers']
    ): Promise<CreateUserMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<CreateUserMutation>(CreateUserDocument, variables, {
            ...requestHeaders,
            ...wrappedRequestHeaders,
          }),
        'createUser',
        'mutation'
      );
    },
    deleteMessage(
      variables: DeleteMessageMutationVariables,
      requestHeaders?: Dom.RequestInit['headers']
    ): Promise<DeleteMessageMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<DeleteMessageMutation>(
            DeleteMessageDocument,
            variables,
            { ...requestHeaders, ...wrappedRequestHeaders }
          ),
        'deleteMessage',
        'mutation'
      );
    },
    getMessageById(
      variables: GetMessageByIdQueryVariables,
      requestHeaders?: Dom.RequestInit['headers']
    ): Promise<GetMessageByIdQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<GetMessageByIdQuery>(
            GetMessageByIdDocument,
            variables,
            { ...requestHeaders, ...wrappedRequestHeaders }
          ),
        'getMessageById',
        'query'
      );
    },
    getMessages(
      variables: GetMessagesQueryVariables,
      requestHeaders?: Dom.RequestInit['headers']
    ): Promise<GetMessagesQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<GetMessagesQuery>(GetMessagesDocument, variables, {
            ...requestHeaders,
            ...wrappedRequestHeaders,
          }),
        'getMessages',
        'query'
      );
    },
    getUser(
      variables: GetUserQueryVariables,
      requestHeaders?: Dom.RequestInit['headers']
    ): Promise<GetUserQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<GetUserQuery>(GetUserDocument, variables, {
            ...requestHeaders,
            ...wrappedRequestHeaders,
          }),
        'getUser',
        'query'
      );
    },
    sendMessage(
      variables: SendMessageMutationVariables,
      requestHeaders?: Dom.RequestInit['headers']
    ): Promise<SendMessageMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<SendMessageMutation>(SendMessageDocument, variables, {
            ...requestHeaders,
            ...wrappedRequestHeaders,
          }),
        'sendMessage',
        'mutation'
      );
    },
  };
}
export type Sdk = ReturnType<typeof getSdk>;
