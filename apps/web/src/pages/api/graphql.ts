import 'reflect-metadata';
import { startServerAndCreateNextHandler } from '@as-integrations/next';
import responseCachePlugin from '@apollo/server-plugin-response-cache';
import { NextApiRequest, NextApiResponse } from 'next/types';
import { ApolloServer } from '@apollo/server';
import { getSession } from 'next-auth/react';
import { buildSchema } from 'type-graphql';
import { PrismaClient } from '@umamin/db';

import rateLimit from '@/utils/rate-limit';
import { UserResolver } from '@/schema/user';
import { MessageResolver } from '@/schema/message';

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
  plugins: [responseCachePlugin()],
});

const _handler = startServerAndCreateNextHandler(server, {
  context: async (req) => {
    const session = await getSession({ req });
    const id = session?.user?.id;
    return { prisma, id };
  },
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  res.setHeader('Access-Control-Allow-Origin', process.env.NEXTAUTH_URL as string);
  res.setHeader('Cache-Control', 's-maxage=86400');

  try {
    await limiter.check(res, 20, 'CACHE_TOKEN');
    res.status(200);
  } catch {
    res.status(429);
  }

  return _handler(req, res);
}
