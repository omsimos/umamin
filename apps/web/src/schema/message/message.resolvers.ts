/* eslint-disable no-console */
import { Resolver, Query, Mutation, Ctx, Arg, ID } from 'type-graphql';
import { Prisma } from '@umamin/db';

import type { TContext } from '@/pages/api/graphql';
import {
  RecentMessage,
  SeenMessage,
  SendMessageInput,
  SentMessage,
} from './message.types';

@Resolver()
export class MessageResolver {
  @Query(() => [RecentMessage], { nullable: true })
  async getRecentMessages(
    @Arg('cursorId', () => ID, { nullable: true }) cursorId: string,
    @Ctx() { prisma, id }: TContext
  ): Promise<RecentMessage[] | null> {
    try {
      let messages: RecentMessage[];

      const fields: Prisma.MessageFindManyArgs = {
        where: { receiverId: id, isOpened: false },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: {
          id: true,
          clue: true,
          content: true,
          createdAt: true,
          receiverMsg: true,
        },
      };

      if (!cursorId) {
        messages = await prisma.message.findMany(fields);
      } else {
        messages = await prisma.message.findMany({
          ...fields,
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

  @Query(() => [SeenMessage], { nullable: true })
  async getSeenMessages(
    @Arg('cursorId', () => ID, { nullable: true }) cursorId: string,
    @Ctx() { prisma, id }: TContext
  ): Promise<SeenMessage[] | null> {
    try {
      let messages: SeenMessage[];

      const fields: Prisma.MessageFindManyArgs = {
        where: { receiverId: id, isOpened: true },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: {
          id: true,
          clue: true,
          content: true,
          createdAt: true,
          receiverMsg: true,
        },
      };

      if (!cursorId) {
        messages = await prisma.message.findMany(fields);
      } else {
        messages = await prisma.message.findMany({
          ...fields,
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

  @Query(() => [SentMessage], { nullable: true })
  async getSentMessages(
    @Arg('cursorId', () => ID, { nullable: true }) cursorId: string,
    @Ctx() { prisma, id }: TContext
  ): Promise<SentMessage[] | null> {
    try {
      let messages: SentMessage[];

      const fields: Prisma.MessageFindManyArgs = {
        where: { senderId: id },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: {
          id: true,
          reply: true,
          content: true,
          createdAt: true,
          receiverMsg: true,
          receiverUsername: true,
        },
      };

      if (!cursorId) {
        messages = await prisma.message.findMany(fields);
      } else {
        messages = await prisma.message.findMany({
          ...fields,
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
