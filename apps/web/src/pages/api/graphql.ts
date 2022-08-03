import 'reflect-metadata';
import { ApolloServerPluginCacheControl } from 'apollo-server-core';
import { ApolloServer } from 'apollo-server-micro';
import { getSession } from 'next-auth/react';
import { buildSchema } from 'type-graphql';
import Cors from 'micro-cors';

import { prisma } from '@/db';
import { UserResolver } from '@/schema/user';
import { MessageResolver } from '@/schema/message';

export interface TContext {
  prisma: typeof prisma;
  username?: string;
  id?: string;
  password?: string;
}

const cors = Cors({
  origin:
    process.env.NODE_ENV === 'production' ? process.env.NEXTAUTH_URL : '*',
});

const schema = await buildSchema({
  resolvers: [UserResolver, MessageResolver],
});

const server = new ApolloServer({
  schema,
  context: async ({ req }) => {
    const session = await getSession({ req });
    const username = session?.user?.username;
    const id = session?.user?.id;
    return { prisma, username, id };
  },
  plugins: [ApolloServerPluginCacheControl({ defaultMaxAge: 60 })],
  csrfPrevention: true,
});

export const config = {
  api: {
    bodyParser: false,
  },
};

const startServer = server.start();

export default cors(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.end();
    return false;
  }

  await startServer;
  return server.createHandler({ path: '/api/graphql' })(req, res);
});
