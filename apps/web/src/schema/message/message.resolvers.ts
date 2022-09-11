/* eslint-disable no-console */
import { Resolver, Query, Mutation, Ctx, Arg, ID } from 'type-graphql';
import { Message, SendMessageInput } from './message.types';
import type { TContext } from '@/pages/api/graphql';

@Resolver()
export class MessageResolver {
  @Query(() => [Message], { nullable: true })
  async getMessages(
    @Arg('userId', () => ID) id: string,
    @Arg('type', () => String) type: 'recent' | 'seen' | 'sent',
    @Arg('cursorId', () => ID, { nullable: true }) cursorId: string,
    /* @Arg('goPrev', () => Boolean) goPrev: boolean, */
    @Ctx() { prisma }: TContext
  ): Promise<Message[] | null> {
    try {
      let messages: Message[];

      const where =
        type === 'sent'
          ? { senderId: id }
          : { receiverId: id, isOpened: type === 'seen' };

      if (!cursorId) {
        messages = await prisma.message.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: 3,
        });
      } else {
        messages = await prisma.message.findMany({
          where,
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

  @Mutation(() => String)
  async sendMessage(
    @Arg('input', () => SendMessageInput)
    { senderEmail, receiverUsername, content, receiverMsg }: SendMessageInput,
    @Ctx() { prisma }: TContext
  ): Promise<String> {
    try {
      const message = await prisma.message.create({
        data: {
          content,
          receiverMsg,
          sender: senderEmail ? { connect: { email: senderEmail } } : undefined,
          receiver: { connect: { username: receiverUsername } },
          username: receiverUsername,
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
