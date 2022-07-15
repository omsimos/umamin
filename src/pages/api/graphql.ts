import 'reflect-metadata';
import { NextApiRequest, NextApiResponse } from 'next';
import { ApolloServer } from 'apollo-server-micro';
import { getSession } from 'next-auth/react';
import { buildSchema } from 'type-graphql';

import { prisma } from '@/db';
import { UserResolver } from '@/schema/user';
import { MessageResolver } from '@/schema/message';

export interface TContext {
  prisma: typeof prisma;
}

const schema = await buildSchema({
  resolvers: [UserResolver, MessageResolver],
});

const server = new ApolloServer({
  schema,
  context: async ({ req }) => {
    const session = await getSession({ req });
    const username = session?.user?.username;
    return { prisma, username };
  },
});
const startServer = server.start();

export const config = {
  api: {
    bodyParser: false,
  },
};

// eslint-disable-next-line consistent-return
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (process.env.NODE_ENV !== 'production') {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader(
      'Access-Control-Allow-Origin',
      'https://studio.apollographql.com'
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Access-Control-Allow-Methods, Access-Control-Allow-Origin, Access-Control-Allow-Credentials, Access-Control-Allow-Headers'
    );
    res.setHeader(
      'Access-Control-Allow-Methods',
      'POST, GET, PUT, PATCH, DELETE, OPTIONS, HEAD'
    );
    if (req.method === 'OPTIONS') {
      res.end();
      return false;
    }
  }

  await startServer;
  await server.createHandler({ path: '/api/graphql' })(req, res);
}
