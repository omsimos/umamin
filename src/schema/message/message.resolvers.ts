/* eslint-disable no-console */
import { Resolver, Query, Mutation, Ctx, Arg, ID, Args } from 'type-graphql';

import { EditMessageArgs, Message, SendMessageInput } from './message.types';
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
    @Arg('userId', () => ID) userId: string,
    @Ctx() { prisma }: TContext
  ): Promise<Message[] | null> {
    try {
      const messages = await prisma.message.findMany({
        where: { receiverId: userId },
        orderBy: { createdAt: 'desc' },
      });

      return messages;
    } catch (err: any) {
      console.error(err);
      throw new Error(err.message);
    }
  }

  @Mutation(() => Message)
  async sendMessage(
    @Arg('input', () => SendMessageInput)
    {
      senderUsername,
      receiverUsername,
      content,
      receiverMsg,
    }: SendMessageInput,
    @Ctx() { prisma }: TContext
  ): Promise<Message> {
    try {
      const message = await prisma.message.create({
        data: {
          content,
          receiverMsg,
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
  async editMessage(
    @Args() { id, isOpened, isDownloaded }: EditMessageArgs,
    @Ctx() { prisma }: TContext
  ): Promise<String> {
    try {
      await prisma.message.update({
        where: { id },
        data: { isOpened, isDownloaded },
      });

      return 'Message edited';
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
