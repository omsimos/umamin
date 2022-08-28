import 'reflect-metadata';
import { ApolloServer } from 'apollo-server-micro';
import { buildSchema } from 'type-graphql';
import Cors from 'micro-cors';

import { prisma } from '@/db';
import { UserResolver } from '@/schema/user';
import { MessageResolver } from '@/schema/message';

export interface TContext {
  prisma: typeof prisma;
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
  context: { prisma },
  csrfPrevention: true,
});

export const config = {
  api: {
    bodyParser: false,
  },
};

const startServer = server.start();

export default cors(async (req, res) => {
  res.setHeader('Cache-Control', ['s-maxage=1', 'stale-while-revalidate']);

  if (req.method === 'OPTIONS') {
    res.end();
    return false;
  }

  await startServer;
  return server.createHandler({ path: '/api/graphql' })(req, res);
});
