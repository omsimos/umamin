/* eslint-disable no-console */
import { Resolver, Query, Mutation, Ctx, Arg, ID } from 'type-graphql';
import { nanoid } from 'nanoid';

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

  @Mutation(() => String)
  async sendMessage(
    @Arg('username', () => String) username: string,
    @Arg('content', () => String) content: string,
    @Ctx() { prisma }: TContext
  ): Promise<String> {
    try {
      await prisma.message.create({
        data: { id: nanoid(), content, sentFor: username },
      });
    } catch (err: any) {
      console.error(err);
      throw new Error(err.message);
    }

    return 'Message sent';
  }

  @Mutation(() => String)
  async deleteMessage(
    @Arg('id', () => ID) id: string,
    @Ctx() { prisma }: TContext
  ): Promise<String> {
    try {
      await prisma.message.delete({ where: { id } });
    } catch (err: any) {
      console.error(err);
      throw new Error(err.message);
    }

    return 'Message deleted';
  }
}
