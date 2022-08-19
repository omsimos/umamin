import { GraphQLClient } from 'graphql-request';
import { QueryClient } from 'react-query';
import Constants from 'expo-constants';
import { getSdk } from '@umamin/generated';

export const GQL_ENDPOINT = Constants.manifest?.extra?.gqlEndpiont;

export const gqlClient = new GraphQLClient(GQL_ENDPOINT);
export const { getUser } = getSdk(gqlClient);

export const queryClient = new QueryClient();
