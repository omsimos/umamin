import 'reflect-metadata';
import { startServerAndCreateNextHandler } from '@as-integrations/next';
import { ApolloServer } from '@apollo/server';
import { getSession } from 'next-auth/react';
import { buildSchema } from 'type-graphql';
import { PrismaClient } from '@umamin/db';

import { UserResolver } from '@/schema/user';
import { MessageResolver } from '@/schema/message';

const prisma = new PrismaClient();

export interface TContext {
  prisma: typeof prisma;
  id?: string;
}

const schema = await buildSchema({
  resolvers: [UserResolver, MessageResolver],
});

const server = new ApolloServer({
  schema,
  cache: 'bounded',
  csrfPrevention: true,
});

export default startServerAndCreateNextHandler(server, {
  context: async (req) => {
    const session = await getSession({ req });
    const id = session?.user?.id;
    return { prisma, id };
  },
});
