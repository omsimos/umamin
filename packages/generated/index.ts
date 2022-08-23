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

export type Message = {
  __typename?: 'Message';
  content: Scalars['String'];
  createdAt: Scalars['DateTime'];
  id: Scalars['ID'];
  isOpened: Scalars['Boolean'];
  receiverId: Scalars['String'];
  receiverMsg: Scalars['String'];
  senderId?: Maybe<Scalars['String']>;
};

export type Mutation = {
  __typename?: 'Mutation';
  deleteMessage: Scalars['String'];
  deleteUser: Scalars['String'];
  editMessage: Scalars['String'];
  editUser: Scalars['String'];
  sendMessage: Scalars['String'];
};


export type MutationDeleteMessageArgs = {
  id: Scalars['ID'];
};


export type MutationDeleteUserArgs = {
  email: Scalars['String'];
};


export type MutationEditMessageArgs = {
  id: Scalars['ID'];
  isOpened: Scalars['Boolean'];
};


export type MutationEditUserArgs = {
  email: Scalars['String'];
  message: Scalars['String'];
};


export type MutationSendMessageArgs = {
  input: SendMessageInput;
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
  cursorId?: InputMaybe<Scalars['ID']>;
  userId: Scalars['ID'];
};


export type QueryUserArgs = {
  type: Scalars['String'];
  user: Scalars['String'];
};

export type SendMessageInput = {
  content: Scalars['String'];
  receiverMsg: Scalars['String'];
  receiverUsername: Scalars['String'];
  senderUsername?: InputMaybe<Scalars['String']>;
};

export type User = {
  __typename?: 'User';
  email?: Maybe<Scalars['String']>;
  id: Scalars['ID'];
  image?: Maybe<Scalars['String']>;
  message: Scalars['String'];
  name?: Maybe<Scalars['String']>;
  username?: Maybe<Scalars['String']>;
};

export type DeleteMessageMutationVariables = Exact<{
  id: Scalars['ID'];
}>;


export type DeleteMessageMutation = { __typename?: 'Mutation', deleteMessage: string };

export type DeleteUserMutationVariables = Exact<{
  email: Scalars['String'];
}>;


export type DeleteUserMutation = { __typename?: 'Mutation', deleteUser: string };

export type EditMessageMutationVariables = Exact<{
  id: Scalars['ID'];
  isOpened: Scalars['Boolean'];
}>;


export type EditMessageMutation = { __typename?: 'Mutation', editMessage: string };

export type EditUserMutationVariables = Exact<{
  email: Scalars['String'];
  message: Scalars['String'];
}>;


export type EditUserMutation = { __typename?: 'Mutation', editUser: string };

export type GetMessageByIdQueryVariables = Exact<{
  id: Scalars['ID'];
}>;


export type GetMessageByIdQuery = { __typename?: 'Query', message: { __typename?: 'Message', id: string, content: string, senderId?: string | null, receiverId: string, receiverMsg: string } };

export type GetMessagesQueryVariables = Exact<{
  userId: Scalars['ID'];
  cursorId?: InputMaybe<Scalars['ID']>;
}>;


export type GetMessagesQuery = { __typename?: 'Query', messages?: Array<{ __typename?: 'Message', id: string, content: string, isOpened: boolean, createdAt: any, receiverMsg: string }> | null };

export type GetUserQueryVariables = Exact<{
  user: Scalars['String'];
  type: Scalars['String'];
}>;


export type GetUserQuery = { __typename?: 'Query', user?: { __typename?: 'User', id: string, username?: string | null, message: string, email?: string | null, image?: string | null } | null };

export type SendMessageMutationVariables = Exact<{
  input: SendMessageInput;
}>;


export type SendMessageMutation = { __typename?: 'Mutation', sendMessage: string };


export const DeleteMessageDocument = gql`
    mutation deleteMessage($id: ID!) {
  deleteMessage(id: $id)
}
    `;
export const DeleteUserDocument = gql`
    mutation deleteUser($email: String!) {
  deleteUser(email: $email)
}
    `;
export const EditMessageDocument = gql`
    mutation editMessage($id: ID!, $isOpened: Boolean!) {
  editMessage(id: $id, isOpened: $isOpened)
}
    `;
export const EditUserDocument = gql`
    mutation editUser($email: String!, $message: String!) {
  editUser(email: $email, message: $message)
}
    `;
export const GetMessageByIdDocument = gql`
    query getMessageById($id: ID!) {
  message(id: $id) {
    id
    content
    senderId
    receiverId
    receiverMsg
  }
}
    `;
export const GetMessagesDocument = gql`
    query getMessages($userId: ID!, $cursorId: ID) {
  messages(userId: $userId, cursorId: $cursorId) {
    id
    content
    isOpened
    createdAt
    receiverMsg
  }
}
    `;
export const GetUserDocument = gql`
    query getUser($user: String!, $type: String!) {
  user(user: $user, type: $type) {
    id
    username
    message
    email
    image
  }
}
    `;
export const SendMessageDocument = gql`
    mutation sendMessage($input: SendMessageInput!) {
  sendMessage(input: $input)
}
    `;

export type SdkFunctionWrapper = <T>(action: (requestHeaders?:Record<string, string>) => Promise<T>, operationName: string, operationType?: string) => Promise<T>;


const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType) => action();

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    deleteMessage(variables: DeleteMessageMutationVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<DeleteMessageMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<DeleteMessageMutation>(DeleteMessageDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'deleteMessage', 'mutation');
    },
    deleteUser(variables: DeleteUserMutationVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<DeleteUserMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<DeleteUserMutation>(DeleteUserDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'deleteUser', 'mutation');
    },
    editMessage(variables: EditMessageMutationVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<EditMessageMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<EditMessageMutation>(EditMessageDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'editMessage', 'mutation');
    },
    editUser(variables: EditUserMutationVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<EditUserMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<EditUserMutation>(EditUserDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'editUser', 'mutation');
    },
    getMessageById(variables: GetMessageByIdQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<GetMessageByIdQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetMessageByIdQuery>(GetMessageByIdDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getMessageById', 'query');
    },
    getMessages(variables: GetMessagesQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<GetMessagesQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetMessagesQuery>(GetMessagesDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getMessages', 'query');
    },
    getUser(variables: GetUserQueryVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<GetUserQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<GetUserQuery>(GetUserDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'getUser', 'query');
    },
    sendMessage(variables: SendMessageMutationVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<SendMessageMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<SendMessageMutation>(SendMessageDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'sendMessage', 'mutation');
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;