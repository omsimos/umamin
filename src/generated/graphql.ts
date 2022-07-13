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
  sentFor: Scalars['String'];
};

export type Mutation = {
  __typename?: 'Mutation';
  createUser: User;
  deleteMessage: Scalars['String'];
  login: Scalars['String'];
  sendMessage: Scalars['String'];
};

export type MutationCreateUserArgs = {
  username: Scalars['String'];
};

export type MutationDeleteMessageArgs = {
  id: Scalars['ID'];
};

export type MutationLoginArgs = {
  password: Scalars['String'];
  username: Scalars['String'];
};

export type MutationSendMessageArgs = {
  content: Scalars['String'];
  username: Scalars['String'];
};

export type Query = {
  __typename?: 'Query';
  message: Message;
  messages?: Maybe<Array<Message>>;
  user: User;
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
}>;

export type CreateUserMutation = {
  __typename?: 'Mutation';
  createUser: { __typename?: 'User'; username: string; password: string };
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
  message: { __typename?: 'Message'; content: string };
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
  user: { __typename?: 'User'; username: string; password: string };
};

export type LoginUserMutationVariables = Exact<{
  username: Scalars['String'];
  password: Scalars['String'];
}>;

export type LoginUserMutation = { __typename?: 'Mutation'; login: string };

export type SendMessageMutationVariables = Exact<{
  username: Scalars['String'];
  content: Scalars['String'];
}>;

export type SendMessageMutation = {
  __typename?: 'Mutation';
  sendMessage: string;
};

export const CreateUserDocument = gql`
  mutation createUser($username: String!) {
    createUser(username: $username) {
      username
      password
    }
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
      content
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
      password
    }
  }
`;
export const LoginUserDocument = gql`
  mutation loginUser($username: String!, $password: String!) {
    login(username: $username, password: $password)
  }
`;
export const SendMessageDocument = gql`
  mutation sendMessage($username: String!, $content: String!) {
    sendMessage(username: $username, content: $content)
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
    loginUser(
      variables: LoginUserMutationVariables,
      requestHeaders?: Dom.RequestInit['headers']
    ): Promise<LoginUserMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<LoginUserMutation>(LoginUserDocument, variables, {
            ...requestHeaders,
            ...wrappedRequestHeaders,
          }),
        'loginUser',
        'mutation'
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
