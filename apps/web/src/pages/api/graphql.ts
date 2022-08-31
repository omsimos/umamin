import 'reflect-metadata';
import { NextApiRequest, NextApiResponse } from 'next';
import { ApolloServer } from 'apollo-server-micro';
import { buildSchema } from 'type-graphql';
import { PrismaClient } from '@umamin/db';
import { getToken } from 'next-auth/jwt';

import rateLimit from '@/utils/rate-limit';
import { UserResolver } from '@/schema/user';
import { MessageResolver } from '@/schema/message';

const prisma = new PrismaClient();

export interface TContext {
  prisma: typeof prisma;
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
  context: { prisma },
  csrfPrevention: true,
});

export const config = {
  api: {
    bodyParser: false,
  },
};

const startServer = server.start();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  res.setHeader('Cache-Control', ['s-maxage=1', 'stale-while-revalidate']);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = await getToken({ req });
  if (!token) {
    return res.status(401).json({ error: 'Not authorized' });
  }

  try {
    await limiter.check(res, 10, 'CACHE_TOKEN'); // 10 requests per minute
  } catch {
    res
      .status(429)
      .json({ errors: [{ message: 'You are being rate limited' }] });
  }

  await startServer;
  return server.createHandler({ path: '/api/graphql' })(req, res);
}
