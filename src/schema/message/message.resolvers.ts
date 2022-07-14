/* eslint-disable no-console */
import { Resolver, Query, Mutation, Ctx, Arg, ID } from 'type-graphql';

import { Message } from './message.types';
import type { TContext } from '@/pages/api/graphql';

@Resolver()
export class MessageResolver {
  @Query(() => Message)
  async message(
    @Arg('id', () => ID) id: string,
    @Ctx() { prisma }: TContext
  ): Promise<Message> {
    try {
      const message = await prisma.message.findUnique({ where: { id } });

      if (!message) {
        throw new Error('Message not found');
      }

      return message;
    } catch (err: any) {
      console.error(err);
      throw new Error(err.message);
    }
  }

  @Query(() => [Message], { nullable: true })
  async messages(
    @Arg('username', () => String) username: string,
    @Ctx() { prisma }: TContext
  ): Promise<Message[] | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { username },
        select: { receivedMessages: true },
      });

      if (!user) {
        throw new Error('User not found');
      }

      return user.receivedMessages;
    } catch (err: any) {
      console.error(err);
      throw new Error(err.message);
    }
  }

  @Mutation(() => Message)
  async sendMessage(
    @Arg('senderUsername', () => String, { nullable: true })
    senderUsername: string | null,
    @Arg('receiverUsername', () => String) receiverUsername: string,
    @Arg('content', () => String) content: string,
    @Ctx() { prisma }: TContext
  ): Promise<Message> {
    try {
      const message = await prisma.message.create({
        data: {
          content,
          sender: senderUsername
            ? { connect: { username: senderUsername } }
            : undefined,
          receiver: { connect: { username: receiverUsername } },
        },
      });

      return message;
    } catch (err: any) {
      console.error(err);
      throw new Error(err.message);
    }
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
