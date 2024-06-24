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
    'Account': { kind: 'OBJECT'; name: 'Account'; fields: { 'createdAt': { name: 'createdAt'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'Int'; ofType: null; }; } }; 'email': { name: 'email'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; 'id': { name: 'id'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'ID'; ofType: null; }; } }; 'picture': { name: 'picture'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; }; };
    'Boolean': unknown;
    'CreateMessageInput': { kind: 'INPUT_OBJECT'; name: 'CreateMessageInput'; isOneOf: false; inputFields: [{ name: 'content'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; }; defaultValue: null }, { name: 'question'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; }; defaultValue: null }, { name: 'receiverId'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; }; defaultValue: null }, { name: 'senderId'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; }; defaultValue: null }]; };
    'CursorInput': { kind: 'INPUT_OBJECT'; name: 'CursorInput'; isOneOf: false; inputFields: [{ name: 'createdAt'; type: { kind: 'SCALAR'; name: 'Int'; ofType: null; }; defaultValue: null }, { name: 'id'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; }; defaultValue: null }]; };
    'Date': unknown;
    'Float': unknown;
    'ID': unknown;
    'Int': unknown;
    'JSON': unknown;
    'Message': { kind: 'OBJECT'; name: 'Message'; fields: { 'content': { name: 'content'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; 'createdAt': { name: 'createdAt'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'Int'; ofType: null; }; } }; 'id': { name: 'id'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'ID'; ofType: null; }; } }; 'question': { name: 'question'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; 'receiver': { name: 'receiver'; type: { kind: 'OBJECT'; name: 'User'; ofType: null; } }; 'receiverId': { name: 'receiverId'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; 'reply': { name: 'reply'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'updatedAt': { name: 'updatedAt'; type: { kind: 'SCALAR'; name: 'Int'; ofType: null; } }; }; };
    'MessageCursor': { kind: 'OBJECT'; name: 'MessageCursor'; fields: { 'createdAt': { name: 'createdAt'; type: { kind: 'SCALAR'; name: 'Int'; ofType: null; } }; 'id': { name: 'id'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; }; };
    'MessagesFromCursorInput': { kind: 'INPUT_OBJECT'; name: 'MessagesFromCursorInput'; isOneOf: false; inputFields: [{ name: 'cursor'; type: { kind: 'INPUT_OBJECT'; name: 'CursorInput'; ofType: null; }; defaultValue: null }, { name: 'type'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; }; defaultValue: null }]; };
    'MessagesWithCursor': { kind: 'OBJECT'; name: 'MessagesWithCursor'; fields: { 'cursor': { name: 'cursor'; type: { kind: 'OBJECT'; name: 'MessageCursor'; ofType: null; } }; 'data': { name: 'data'; type: { kind: 'LIST'; name: never; ofType: { kind: 'NON_NULL'; name: never; ofType: { kind: 'OBJECT'; name: 'Message'; ofType: null; }; }; } }; 'hasMore': { name: 'hasMore'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'Boolean'; ofType: null; }; } }; }; };
    'Mutation': { kind: 'OBJECT'; name: 'Mutation'; fields: { 'createMessage': { name: 'createMessage'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'OBJECT'; name: 'Message'; ofType: null; }; } }; 'createReply': { name: 'createReply'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; 'deleteMessage': { name: 'deleteMessage'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; 'deleteNote': { name: 'deleteNote'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; 'encryptMessageDemo': { name: 'encryptMessageDemo'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; 'messagesFromCursor': { name: 'messagesFromCursor'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'OBJECT'; name: 'MessagesWithCursor'; ofType: null; }; } }; 'notesFromCursor': { name: 'notesFromCursor'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'OBJECT'; name: 'NotesWithCursor'; ofType: null; }; } }; 'updateNote': { name: 'updateNote'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'OBJECT'; name: 'Note'; ofType: null; }; } }; 'updatePicture': { name: 'updatePicture'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; 'updateQuietMode': { name: 'updateQuietMode'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; 'updateUser': { name: 'updateUser'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; }; };
    'Note': { kind: 'OBJECT'; name: 'Note'; fields: { 'content': { name: 'content'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; 'id': { name: 'id'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'ID'; ofType: null; }; } }; 'isAnonymous': { name: 'isAnonymous'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'Boolean'; ofType: null; }; } }; 'updatedAt': { name: 'updatedAt'; type: { kind: 'SCALAR'; name: 'Int'; ofType: null; } }; 'user': { name: 'user'; type: { kind: 'OBJECT'; name: 'PublicUser'; ofType: null; } }; }; };
    'NoteCursor': { kind: 'OBJECT'; name: 'NoteCursor'; fields: { 'id': { name: 'id'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'updatedAt': { name: 'updatedAt'; type: { kind: 'SCALAR'; name: 'Int'; ofType: null; } }; }; };
    'NotesFromCursorInput': { kind: 'INPUT_OBJECT'; name: 'NotesFromCursorInput'; isOneOf: false; inputFields: [{ name: 'id'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; }; defaultValue: null }, { name: 'updatedAt'; type: { kind: 'SCALAR'; name: 'Int'; ofType: null; }; defaultValue: null }]; };
    'NotesWithCursor': { kind: 'OBJECT'; name: 'NotesWithCursor'; fields: { 'cursor': { name: 'cursor'; type: { kind: 'OBJECT'; name: 'NoteCursor'; ofType: null; } }; 'data': { name: 'data'; type: { kind: 'LIST'; name: never; ofType: { kind: 'NON_NULL'; name: never; ofType: { kind: 'OBJECT'; name: 'Note'; ofType: null; }; }; } }; 'hasMore': { name: 'hasMore'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'Boolean'; ofType: null; }; } }; }; };
    'PublicUser': { kind: 'OBJECT'; name: 'PublicUser'; fields: { 'bio': { name: 'bio'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'createdAt': { name: 'createdAt'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'Int'; ofType: null; }; } }; 'displayName': { name: 'displayName'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'id': { name: 'id'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'ID'; ofType: null; }; } }; 'imageUrl': { name: 'imageUrl'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'question': { name: 'question'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; 'quietMode': { name: 'quietMode'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'Boolean'; ofType: null; }; } }; 'username': { name: 'username'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; }; };
    'Query': { kind: 'OBJECT'; name: 'Query'; fields: { 'messages': { name: 'messages'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'LIST'; name: never; ofType: { kind: 'NON_NULL'; name: never; ofType: { kind: 'OBJECT'; name: 'Message'; ofType: null; }; }; }; } }; 'note': { name: 'note'; type: { kind: 'OBJECT'; name: 'Note'; ofType: null; } }; 'notes': { name: 'notes'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'LIST'; name: never; ofType: { kind: 'NON_NULL'; name: never; ofType: { kind: 'OBJECT'; name: 'Note'; ofType: null; }; }; }; } }; 'user': { name: 'user'; type: { kind: 'OBJECT'; name: 'User'; ofType: null; } }; 'userByUsername': { name: 'userByUsername'; type: { kind: 'OBJECT'; name: 'PublicUser'; ofType: null; } }; }; };
    'String': unknown;
    'UpdateUserInput': { kind: 'INPUT_OBJECT'; name: 'UpdateUserInput'; isOneOf: false; inputFields: [{ name: 'bio'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; }; defaultValue: null }, { name: 'displayName'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; }; defaultValue: null }, { name: 'question'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; }; defaultValue: null }, { name: 'username'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; }; defaultValue: null }]; };
    'User': { kind: 'OBJECT'; name: 'User'; fields: { 'accounts': { name: 'accounts'; type: { kind: 'LIST'; name: never; ofType: { kind: 'NON_NULL'; name: never; ofType: { kind: 'OBJECT'; name: 'Account'; ofType: null; }; }; } }; 'bio': { name: 'bio'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'createdAt': { name: 'createdAt'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'Int'; ofType: null; }; } }; 'displayName': { name: 'displayName'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'id': { name: 'id'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'ID'; ofType: null; }; } }; 'imageUrl': { name: 'imageUrl'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'question': { name: 'question'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; 'quietMode': { name: 'quietMode'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'Boolean'; ofType: null; }; } }; 'username': { name: 'username'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; }; };
  };
};

import * as gqlTada from 'gql.tada';

declare module 'gql.tada' {
  interface setupSchema {
    introspection: introspection
  }
}