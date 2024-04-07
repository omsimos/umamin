import 'reflect-metadata';
import { startServerAndCreateNextHandler } from '@as-integrations/next';
import responseCachePlugin from '@apollo/server-plugin-response-cache';
import { NextApiRequest, NextApiResponse } from 'next/types';
import { ApolloServer } from '@apollo/server';
import { getSession } from 'next-auth/react';
import { buildSchema } from 'type-graphql';

import prisma from '@/lib/db';
import { UserResolver } from '@/schema/user';
import { MessageResolver } from '@/schema/message';
import { GlobalMessageResolver } from '@/schema/global-message';

export interface TContext {
  prisma: typeof prisma;
  id?: string;
  req: NextApiRequest;
}

const schema = await buildSchema({
  resolvers: [UserResolver, MessageResolver, GlobalMessageResolver],
});

const server = new ApolloServer({
  schema,
  plugins: [responseCachePlugin()],
});

const _handler = startServerAndCreateNextHandler(server, {
  context: async (req) => {
    const session = await getSession({ req });
    const id = session?.user?.id;
    return { prisma, id, req };
  },
});

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader(
    'Access-Control-Allow-Origin',
    process.env.NEXT_PUBLIC_GQL_ENDPOINT ?? 'http://localhost:3000'
  );
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 's-maxage=86400');

  return _handler(req, res);
}
