/* eslint-disable no-console */
import { Resolver, Query, Mutation, Ctx, Arg, ID } from 'type-graphql';
import { Message, SendMessageInput } from './message.types';
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
  async getMessages(
    @Arg('userId', () => ID) id: string,
    @Arg('type', () => String) type: 'recent' | 'seen',
    @Arg('cursorId', () => ID, { nullable: true }) cursorId: string,
    /* @Arg('goPrev', () => Boolean) goPrev: boolean, */
    @Ctx() { prisma }: TContext
  ): Promise<Message[] | null> {
    try {
      let messages: Message[];

      if (!cursorId) {
        messages = await prisma.message.findMany({
          where: { receiverId: id, isOpened: type === 'seen' },
          orderBy: { createdAt: 'desc' },
          take: 3,
        });
      } else {
        messages = await prisma.message.findMany({
          where: { receiverId: id },
          orderBy: { createdAt: 'desc' },
          take: 3,
          skip: 1,
          cursor: {
            id: cursorId,
          },
        });
      }

      return messages;
    } catch (err: any) {
      console.error(err);
      throw new Error(err.message);
    }
  }

  @Query(() => [Message], { nullable: true })
  async getRepliedMessages(
    @Arg('userId', () => ID) id: string,
    @Arg('cursorId', () => ID, { nullable: true }) cursorId: string,
    /* @Arg('goPrev', () => Boolean) goPrev: boolean, */
    @Ctx() { prisma }: TContext
  ): Promise<Message[] | null> {
    try {
      let messages: Message[];

      if (!cursorId) {
        messages = await prisma.message.findMany({
          where: {
            receiverId: id,
            NOT: [
              {
                reply: null,
              },
            ],
          },
          orderBy: { updatedAt: 'desc' },
          take: 3,
        });
      } else {
        messages = await prisma.message.findMany({
          where: {
            receiverId: id,
            NOT: [
              {
                reply: null,
              },
            ],
          },
          orderBy: { updatedAt: 'desc' },
          take: 3,
          skip: 1,
          cursor: {
            id: cursorId,
          },
        });
      }

      return messages;
    } catch (err: any) {
      console.error(err);
      throw new Error(err.message);
    }
  }

  @Mutation(() => String)
  async sendMessage(
    @Arg('input', () => SendMessageInput)
    {
      senderUsername,
      receiverUsername,
      content,
      receiverMsg,
    }: SendMessageInput,
    @Ctx() { prisma }: TContext
  ): Promise<String> {
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

      return message.content;
    } catch (err: any) {
      console.error(err);
      throw new Error(err.message);
    }
  }

  @Mutation(() => String)
  async editMessage(
    @Arg('id', () => ID) id: string,
    @Arg('isOpened', () => Boolean) isOpened: boolean,
    @Ctx() { prisma }: TContext
  ): Promise<String> {
    try {
      await prisma.message.update({
        where: { id },
        data: { isOpened },
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

  @Mutation(() => String)
  async addReply(
    @Arg('id', () => ID) id: string,
    @Arg('content', () => String) content: string,
    @Ctx() { prisma }: TContext
  ) {
    try {
      await prisma.message.update({
        where: { id },
        data: { reply: content },
      });
    } catch (err: any) {
      console.error(err);
      throw new Error(err.message);
    }

    return 'Reply added';
  }
}
