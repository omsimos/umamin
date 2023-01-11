import 'reflect-metadata';
import { ApolloServer } from 'apollo-server-micro';
import { getSession } from 'next-auth/react';
import { buildSchema } from 'type-graphql';
import { PrismaClient } from '@umamin/db';
import Cors from 'micro-cors';

import rateLimit from '@/utils/rate-limit';
import { UserResolver } from '@/schema/user';
import { MessageResolver } from '@/schema/message';

const cors = Cors({
  origin:
    process.env.NODE_ENV === 'production' ? process.env.NEXTAUTH_URL : '*',
});

const prisma = new PrismaClient();

export interface TContext {
  prisma: typeof prisma;
  id?: string;
}

const limiter = rateLimit({
  interval: 60 * 1000, // 60 seconds
  uniqueTokenPerInterval: 500, // Max 500 users per second
});

const schema = await buildSchema({
  resolvers: [UserResolver, MessageResolver],
});

const server = new ApolloServer({
  schema,
  cache: 'bounded',
  context: async ({ req }) => {
    const session = await getSession({ req });
    const id = session?.user?.id;
    return { prisma, id };
  },
  csrfPrevention: true,
});

export const config = {
  api: {
    bodyParser: false,
  },
};

const startServer = server.start();

export default cors(async (req, res) => {
  res.setHeader('Cache-Control', ['max-age=0', 's-maxage=86400']);

  if (req.method === 'OPTIONS') {
    res.end();
    return false;
  }

  try {
    await limiter.check(res, 20, 'CACHE_TOKEN'); // 20 requests per minute
  } catch {
    res.writeHead(429);
  }

  await startServer;
  return server.createHandler({ path: '/api/graphql' })(req, res);
});
