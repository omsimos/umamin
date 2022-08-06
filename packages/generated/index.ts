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
  changePassword: Scalars['String'];
  createUser: Scalars['String'];
  deleteMessage: Scalars['String'];
  editMessage: Scalars['String'];
  editUser: Scalars['String'];
  sendMessage: Scalars['String'];
};


export type MutationChangePasswordArgs = {
  newPassword: Scalars['String'];
  username: Scalars['String'];
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


export type MutationEditUserArgs = {
  message: Scalars['String'];
  username: Scalars['String'];
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
  username: Scalars['String'];
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
  imgUrl?: Maybe<Scalars['String']>;
  message: Scalars['String'];
  password: Scalars['String'];
  username: Scalars['String'];
};

export type ChangePasswordMutationVariables = Exact<{
  username: Scalars['String'];
  newPassword: Scalars['String'];
}>;


export type ChangePasswordMutation = { __typename?: 'Mutation', changePassword: string };

export type CreateUserMutationVariables = Exact<{
  username: Scalars['String'];
  password: Scalars['String'];
}>;


export type CreateUserMutation = { __typename?: 'Mutation', createUser: string };

export type DeleteMessageMutationVariables = Exact<{
  id: Scalars['ID'];
}>;


export type DeleteMessageMutation = { __typename?: 'Mutation', deleteMessage: string };

export type EditMessageMutationVariables = Exact<{
  id: Scalars['ID'];
  isOpened: Scalars['Boolean'];
}>;


export type EditMessageMutation = { __typename?: 'Mutation', editMessage: string };

export type EditUserMutationVariables = Exact<{
  username: Scalars['String'];
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
  username: Scalars['String'];
}>;


export type GetUserQuery = { __typename?: 'Query', user?: { __typename?: 'User', username: string, password: string, message: string, email?: string | null, imgUrl?: string | null } | null };

export type SendMessageMutationVariables = Exact<{
  input: SendMessageInput;
}>;


export type SendMessageMutation = { __typename?: 'Mutation', sendMessage: string };


export const ChangePasswordDocument = gql`
    mutation changePassword($username: String!, $newPassword: String!) {
  changePassword(username: $username, newPassword: $newPassword)
}
    `;
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
export const EditMessageDocument = gql`
    mutation editMessage($id: ID!, $isOpened: Boolean!) {
  editMessage(id: $id, isOpened: $isOpened)
}
    `;
export const EditUserDocument = gql`
    mutation editUser($username: String!, $message: String!) {
  editUser(username: $username, message: $message)
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
    query getUser($username: String!) {
  user(username: $username) {
    username
    password
    message
    email
    imgUrl
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
    changePassword(variables: ChangePasswordMutationVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<ChangePasswordMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<ChangePasswordMutation>(ChangePasswordDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'changePassword', 'mutation');
    },
    createUser(variables: CreateUserMutationVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<CreateUserMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<CreateUserMutation>(CreateUserDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'createUser', 'mutation');
    },
    deleteMessage(variables: DeleteMessageMutationVariables, requestHeaders?: Dom.RequestInit["headers"]): Promise<DeleteMessageMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<DeleteMessageMutation>(DeleteMessageDocument, variables, {...requestHeaders, ...wrappedRequestHeaders}), 'deleteMessage', 'mutation');
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