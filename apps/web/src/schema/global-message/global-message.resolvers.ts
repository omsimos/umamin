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
  GlobalMessagesData,
  SendGlobalMessage,
  SendGlobalMessageInput,
  GlobalMessage,
} from './global-message.types';

@Resolver()
export class GlobalMessageResolver {
  @Directive('@cacheControl(maxAge: 240)')
  @Query(() => GlobalMessagesData, { nullable: true })
  async getGlobalMessages(
    @Arg('cursorId', () => ID, { nullable: true }) cursorId: string,
    @Ctx() { prisma }: TContext
  ): Promise<GlobalMessagesData | null> {
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

      if (messages.length === 0) {
        return {
          data: [],
          cursorId: null,
        };
      }

      return {
        data: messages,
        cursorId: messages[messages.length - 1].userId,
      };
    } catch (err) {
      console.log(err);
      throw err;
    }
  }

  @Directive('@cacheControl(maxAge: 60)')
  @Mutation(() => SendGlobalMessage)
  async sendGlobalMessage(
    @Arg('input', () => SendGlobalMessageInput)
    { userId, content, isAnonymous }: SendGlobalMessageInput,
    @Ctx() { prisma }: TContext
  ): Promise<SendGlobalMessage> {
    let latestMessage: Omit<GlobalMessage, 'user'> | null;

    try {
      latestMessage = await prisma.globalMessage.findFirst({
        where: { userId },
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
      console.log(err);
      throw err;
    }

    try {
      let message: GlobalMessage;

      if (!latestMessage) {
        message = await prisma.globalMessage.create({
          data: {
            content,
            isAnonymous,
            user: userId ? { connect: { id: userId } } : undefined,
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
            user: userId ? { connect: { id: userId } } : undefined,
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
      console.log(err);
      throw err;
    }
  }
}
