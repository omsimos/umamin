/* eslint-disable no-console */
import {
  Resolver,
  Query,
  Mutation,
  Ctx,
  Arg,
  ID,
  Directive,
} from 'type-graphql';

import type { TContext } from '@/pages/api/graphql';
import {
  GlobalMessage,
  SendGlobalMessage,
  SendGlobalMessageInput,
  SendMessageInput,
  MessagesData,
} from './message.types';
import { ErrorResponse } from '../types';

@Resolver()
export class MessageResolver {
  @Query(() => ErrorResponse)
  hello(): ErrorResponse {
    return { error: 'hi' };
  }

  @Directive('@cacheControl(maxAge: 240)')
  @Query(() => [GlobalMessage], { nullable: true })
  async getGlobalMessages(
    @Arg('cursorId', () => ID, { nullable: true }) cursorId: string,
    @Ctx() { prisma }: TContext
  ): Promise<GlobalMessage[] | null> {
    try {
      const messages = await prisma.globalMessage.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 10,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              image: true,
            },
          },
        },
        ...(cursorId && {
          skip: 1,
          cursor: {
            id: cursorId,
          },
        }),
      });

      return messages;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  @Directive('@cacheControl(maxAge: 60)')
  @Mutation(() => SendGlobalMessage)
  async sendGlobalMessage(
    @Arg('input', () => SendGlobalMessageInput)
    { content, isAnonymous }: SendGlobalMessageInput,
    @Ctx() { prisma, id }: TContext
  ): Promise<SendGlobalMessage> {
    let latestMessage: Omit<GlobalMessage, 'user'> | null;

    try {
      latestMessage = await prisma.globalMessage.findFirst({
        where: { userId: id },
        orderBy: { updatedAt: 'desc' },
      });

      if (latestMessage?.updatedAt) {
        const diff = new Date().getTime() - latestMessage.updatedAt.getTime();

        if (diff < 1000 * 60 && process.env.NODE_ENV !== 'development') {
          return {
            error: 'You can only send a message once every 1 minute.',
          };
        }
      }
    } catch (err) {
      console.error(err);
      throw err;
    }

    try {
      let message: GlobalMessage;

      if (!latestMessage) {
        message = await prisma.globalMessage.create({
          data: {
            content,
            isAnonymous,
            user: id ? { connect: { id } } : undefined,
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                image: true,
              },
            },
          },
        });
      } else {
        message = await prisma.globalMessage.update({
          where: { id: latestMessage?.id },
          data: {
            content,
            isAnonymous,
            user: id ? { connect: { id } } : undefined,
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                image: true,
              },
            },
          },
        });
      }

      return { data: message };
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  @Query(() => MessagesData, { nullable: true })
  async getMessages(
    @Arg('type', () => String) type: 'recent' | 'sent',
    @Arg('cursorId', () => ID, { nullable: true }) cursorId: string,
    @Ctx() { prisma, id }: TContext
  ): Promise<MessagesData | null> {
    try {
      const messages = await prisma.message.findMany({
        where: type === 'recent' ? { receiverId: id } : { senderId: id },
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
      console.error(err);
      throw err;
    }
  }

  @Mutation(() => String)
  async sendMessage(
    @Arg('input', () => SendMessageInput)
    { clue, content, receiverMsg, receiverUsername }: SendMessageInput,
    @Ctx() { prisma, id }: TContext
  ): Promise<String> {
    try {
      const message = await prisma.message.create({
        data: {
          clue,
          content,
          receiverMsg,
          sender: id ? { connect: { id } } : undefined,
          receiver: { connect: { username: receiverUsername } },
          receiverUsername,
        },
      });

      return message.content;
    } catch (err) {
      console.error(err);
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
      console.error(err);
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
      console.error(err);
      throw err;
    }

    return 'Reply added';
  }
}
