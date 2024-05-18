/* eslint-disable */
/* prettier-ignore */

/** An IntrospectionQuery representation of your schema.
 *
 * @remarks
 * This is an introspection of your schema saved as a file by GraphQLSP.
 * It will automatically be used by `gql.tada` to infer the types of your GraphQL documents.
 * If you need to reuse this data or update your `scalars`, update `tadaOutputLocation` to
 * instead save to a .ts instead of a .d.ts file.
 */
export type introspection = {
  name: never;
  query: 'Query';
  mutation: 'Mutation';
  subscription: never;
  types: {
    'Boolean': unknown;
    'CreateMessageInput': { kind: 'INPUT_OBJECT'; name: 'CreateMessageInput'; isOneOf: false; inputFields: [{ name: 'content'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; }; defaultValue: null }, { name: 'question'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; }; defaultValue: null }, { name: 'senderId'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; }; defaultValue: null }, { name: 'userId'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; }; defaultValue: null }]; };
    'CursorInput': { kind: 'INPUT_OBJECT'; name: 'CursorInput'; isOneOf: false; inputFields: [{ name: 'createdAt'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; }; defaultValue: null }, { name: 'id'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; }; defaultValue: null }]; };
    'Date': unknown;
    'Float': unknown;
    'ID': unknown;
    'Int': unknown;
    'JSON': unknown;
    'Message': { kind: 'OBJECT'; name: 'Message'; fields: { 'content': { name: 'content'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; 'createdAt': { name: 'createdAt'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; 'id': { name: 'id'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'ID'; ofType: null; }; } }; 'question': { name: 'question'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; 'senderId': { name: 'senderId'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'user': { name: 'user'; type: { kind: 'OBJECT'; name: 'User'; ofType: null; } }; 'userId': { name: 'userId'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; }; };
    'MessageCursor': { kind: 'OBJECT'; name: 'MessageCursor'; fields: { 'createdAt': { name: 'createdAt'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'hasMore': { name: 'hasMore'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'Boolean'; ofType: null; }; } }; 'id': { name: 'id'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; }; };
    'MessagesFromCursorInput': { kind: 'INPUT_OBJECT'; name: 'MessagesFromCursorInput'; isOneOf: false; inputFields: [{ name: 'cursor'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'INPUT_OBJECT'; name: 'CursorInput'; ofType: null; }; }; defaultValue: null }, { name: 'type'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; }; defaultValue: null }]; };
    'MessagesWithCursor': { kind: 'OBJECT'; name: 'MessagesWithCursor'; fields: { 'cursor': { name: 'cursor'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'OBJECT'; name: 'MessageCursor'; ofType: null; }; } }; 'data': { name: 'data'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'LIST'; name: never; ofType: { kind: 'NON_NULL'; name: never; ofType: { kind: 'OBJECT'; name: 'Message'; ofType: null; }; }; }; } }; }; };
    'Mutation': { kind: 'OBJECT'; name: 'Mutation'; fields: { 'createMessage': { name: 'createMessage'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'OBJECT'; name: 'Message'; ofType: null; }; } }; 'deleteMessage': { name: 'deleteMessage'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; 'messagesFromCursor': { name: 'messagesFromCursor'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'OBJECT'; name: 'MessagesWithCursor'; ofType: null; }; } }; 'updateNote': { name: 'updateNote'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'OBJECT'; name: 'User'; ofType: null; }; } }; 'updateUser': { name: 'updateUser'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'OBJECT'; name: 'User'; ofType: null; }; } }; 'usersWithNoteFromCursor': { name: 'usersWithNoteFromCursor'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'OBJECT'; name: 'UsersWithCursor'; ofType: null; }; } }; }; };
    'Query': { kind: 'OBJECT'; name: 'Query'; fields: { 'currentUser': { name: 'currentUser'; type: { kind: 'OBJECT'; name: 'User'; ofType: null; } }; 'messages': { name: 'messages'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'LIST'; name: never; ofType: { kind: 'NON_NULL'; name: never; ofType: { kind: 'OBJECT'; name: 'Message'; ofType: null; }; }; }; } }; 'userById': { name: 'userById'; type: { kind: 'OBJECT'; name: 'User'; ofType: null; } }; 'userByUsername': { name: 'userByUsername'; type: { kind: 'OBJECT'; name: 'User'; ofType: null; } }; 'usersWithNote': { name: 'usersWithNote'; type: { kind: 'LIST'; name: never; ofType: { kind: 'NON_NULL'; name: never; ofType: { kind: 'OBJECT'; name: 'User'; ofType: null; }; }; } }; }; };
    'String': unknown;
    'UpdateUserInput': { kind: 'INPUT_OBJECT'; name: 'UpdateUserInput'; isOneOf: false; inputFields: [{ name: 'bio'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; }; defaultValue: null }, { name: 'question'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; }; defaultValue: null }, { name: 'quietMode'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'Boolean'; ofType: null; }; }; defaultValue: null }, { name: 'username'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; }; defaultValue: null }]; };
    'User': { kind: 'OBJECT'; name: 'User'; fields: { 'bio': { name: 'bio'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'createdAt': { name: 'createdAt'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; 'email': { name: 'email'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; 'googleId': { name: 'googleId'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; 'id': { name: 'id'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'ID'; ofType: null; }; } }; 'imageUrl': { name: 'imageUrl'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; 'note': { name: 'note'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'question': { name: 'question'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; 'quietMode': { name: 'quietMode'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'Boolean'; ofType: null; }; } }; 'updatedAt': { name: 'updatedAt'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'username': { name: 'username'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; }; };
    'UserCursor': { kind: 'OBJECT'; name: 'UserCursor'; fields: { 'hasMore': { name: 'hasMore'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'Boolean'; ofType: null; }; } }; 'id': { name: 'id'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'updatedAt': { name: 'updatedAt'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; }; };
    'UsersWithCursor': { kind: 'OBJECT'; name: 'UsersWithCursor'; fields: { 'cursor': { name: 'cursor'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'OBJECT'; name: 'UserCursor'; ofType: null; }; } }; 'data': { name: 'data'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'LIST'; name: never; ofType: { kind: 'NON_NULL'; name: never; ofType: { kind: 'OBJECT'; name: 'User'; ofType: null; }; }; }; } }; }; };
    'UsersWithNoteFromCursorInput': { kind: 'INPUT_OBJECT'; name: 'UsersWithNoteFromCursorInput'; isOneOf: false; inputFields: [{ name: 'id'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; }; defaultValue: null }, { name: 'updatedAt'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; }; defaultValue: null }]; };
  };
};

import * as gqlTada from 'gql.tada';

declare module 'gql.tada' {
  interface setupSchema {
    introspection: introspection
  }
}