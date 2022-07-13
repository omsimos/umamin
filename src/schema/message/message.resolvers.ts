/* eslint-disable no-console */
import { Resolver, Query, Ctx, Arg, ID } from 'type-graphql';

import { Message } from './message.types';
import type { TContext } from '@/pages/api/graphql';

@Resolver()
export class MessageResolver {
  @Query(() => Message)
  async message(
    @Arg('id', () => ID) id: string,
    @Ctx() { prisma }: TContext
  ): Promise<Message> {
    let message = {} as Message;

    try {
      const _message = await prisma.message.findUnique({ where: { id } });

      if (!_message) {
        throw new Error('Message not found');
      }

      message = _message;
    } catch (err: any) {
      console.error(err);
      throw new Error(err.message);
    }

    return message;
  }

  @Query(() => [Message], { nullable: true })
  async messages(
    @Arg('username', () => String) username: string,
    @Ctx() { prisma }: TContext
  ): Promise<Message[] | null> {
    let messages = [] as Message[] | null;

    try {
      const user = await prisma.user.findUnique({ where: { username } });

      if (!user) {
        throw new Error('User not found');
      }

      messages = await prisma.message.findMany({
        where: { sentFor: username },
        orderBy: { createdAt: 'desc' },
      });
    } catch (err: any) {
      console.error(err);
      throw new Error(err.message);
    }

    return messages;
  }
}
