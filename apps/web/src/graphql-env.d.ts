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
    'Date': unknown;
    'Float': unknown;
    'ID': unknown;
    'Int': unknown;
    'JSON': unknown;
    'Mutation': { kind: 'OBJECT'; name: 'Mutation'; fields: { 'hello': { name: 'hello'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; }; };
    'Query': { kind: 'OBJECT'; name: 'Query'; fields: { 'getUserByUsername': { name: 'getUserByUsername'; type: { kind: 'OBJECT'; name: 'User'; ofType: null; } }; }; };
    'String': unknown;
    'User': { kind: 'OBJECT'; name: 'User'; fields: { 'createdAt': { name: 'createdAt'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; 'email': { name: 'email'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; 'googleId': { name: 'googleId'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; 'id': { name: 'id'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'ID'; ofType: null; }; } }; 'imageUrl': { name: 'imageUrl'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; 'note': { name: 'note'; type: { kind: 'SCALAR'; name: 'String'; ofType: null; } }; 'username': { name: 'username'; type: { kind: 'NON_NULL'; name: never; ofType: { kind: 'SCALAR'; name: 'String'; ofType: null; }; } }; }; };
  };
};

import * as gqlTada from 'gql.tada';

declare module 'gql.tada' {
  interface setupSchema {
    introspection: introspection
  }
}