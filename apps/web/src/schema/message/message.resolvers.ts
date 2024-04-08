/* eslint-disable no-console */
import { Resolver, Query, Mutation, Ctx, Arg, ID } from 'type-graphql';

import type { TContext } from '@/pages/api/graphql';

import { ErrorResponse } from '../types';
import { SendMessageInput, MessagesData } from './message.types';

@Resolver()
export class MessageResolver {
  @Query(() => ErrorResponse)
  hello(): ErrorResponse {
    return { error: 'hi' };
  }

  @Query(() => MessagesData, { nullable: true })
  async getMessages(
    @Arg('type', () => String) type: 'recent' | 'sent',
    @Arg('userId', () => ID) userId: string,
    @Arg('cursorId', () => ID, { nullable: true }) cursorId: string,
    @Ctx() { prisma }: TContext
  ): Promise<MessagesData | null> {
    try {
      const messages = await prisma.message.findMany({
        where:
          type === 'recent' ? { receiverId: userId } : { senderId: userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          clue: true,
          reply: true,
          content: true,
          createdAt: true,
          receiverMsg: true,
          ...(type === 'sent' && {
            receiverUsername: true,
          }),
        },

        ...(cursorId && {
          skip: 1,
          cursor: {
            id: cursorId,
          },
        }),
      });

      if (messages.length === 0) {
        return {
          data: [],
          cursorId: null,
        };
      }

      return {
        data: messages,
        cursorId: messages[messages.length - 1].id,
      };
    } catch (err) {
      console.log(err);
      throw err;
    }
  }

  @Mutation(() => String)
  async sendMessage(
    @Arg('input', () => SendMessageInput)
    { userId, clue, content, receiverMsg, receiverUsername }: SendMessageInput,
    @Ctx() { prisma }: TContext
  ): Promise<String> {
    try {
      const message = await prisma.message.create({
        data: {
          clue,
          content,
          receiverMsg,
          sender: userId ? { connect: { id: userId } } : undefined,
          receiver: { connect: { username: receiverUsername } },
          receiverUsername,
        },
      });

      return message.content;
    } catch (err) {
      console.log(err);
      throw err;
    }
  }

  @Mutation(() => String)
  async deleteMessage(
    @Arg('id', () => ID) id: string,
    @Ctx() { prisma }: TContext
  ): Promise<String> {
    try {
      await prisma.message.delete({ where: { id } });
    } catch (err) {
      console.log(err);
      throw err;
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
    } catch (err) {
      console.log(err);
      throw err;
    }

    return 'Reply added';
  }
}
