/* eslint-disable no-console */
import { Resolver, Query, Mutation, Arg, Ctx, ID } from 'type-graphql';

import { hashPassword } from '@/utils/helpers';
import type { TContext } from '@/pages/api/graphql';

import { User } from '.';
import { ErrorResponse } from '../types';

@Resolver()
export class UserResolver {
  @Query(() => User, { nullable: true })
  async getUser(
    @Arg('user', () => String) user: string,
    @Arg('type', () => String) type: 'id' | 'username',
    @Ctx() { prisma }: TContext
  ): Promise<User | null> {
    try {
      let data: User | null;

      if (type === 'id') {
        data = await prisma.user.findUnique({ where: { id: user } });
      } else {
        data = await prisma.user.findUnique({ where: { username: user } });
      }

      return data;
    } catch (err) {
      console.log(err);
      throw err;
    }
  }

  @Mutation(() => ErrorResponse)
  async createUser(
    @Arg('username', () => String) username: string,
    @Arg('password', () => String) password: string,
    @Ctx() { prisma }: TContext
  ): Promise<ErrorResponse> {
    const usernameRegex = /^[a-zA-Z0-9]+$/;
    const hashedPassword = hashPassword(password);

    try {
      if (!usernameRegex.test(username)) {
        return { error: 'Username must be alphanumeric' };
      }

      const user = await prisma.user.findUnique({
        where: { username },
      });

      if (user) {
        return { error: 'Username already taken' };
      }

      await prisma.user.create({
        data: {
          username,
          password: hashedPassword,
        },
      });

      return { error: null };
    } catch (err) {
      console.log(err);
      throw err;
    }
  }

  @Mutation(() => ErrorResponse)
  async editUserMessage(
    @Arg('userId', () => ID) userId: string,
    @Arg('message', () => String) message: string,
    @Ctx() { prisma }: TContext
  ): Promise<ErrorResponse> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { message },
      });

      return { error: null };
    } catch (err) {
      console.log(err);
      throw err;
    }
  }

  @Mutation(() => ErrorResponse)
  async editUsername(
    @Arg('userId', () => ID) userId: string,
    @Arg('username', () => String) username: string,
    @Ctx() { prisma }: TContext
  ): Promise<ErrorResponse> {
    const usernameRegex = /^[a-zA-Z0-9]+$/;

    try {
      if (!usernameRegex.test(username)) {
        return { error: 'Username must be alphanumeric' };
      }

      const user = await prisma.user.findUnique({ where: { username } });

      if (user) {
        return { error: 'Username already taken' };
      }

      await prisma.user.update({
        where: { id: userId },
        data: { username },
      });

      return { error: null };
    } catch (err) {
      console.log(err);
      throw err;
    }
  }

  @Mutation(() => ErrorResponse)
  async changePassword(
    @Arg('userId', () => ID) userId: string,
    @Arg('newPassword', () => String) newPassword: string,
    @Ctx() { prisma }: TContext
  ): Promise<ErrorResponse> {
    const hashedPassword = hashPassword(newPassword);

    try {
      await prisma.user.findUnique({
        where: { id: userId },
      });

      await prisma.user.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
        },
      });

      return { error: null };
    } catch (err) {
      console.log(err);
      throw err;
    }
  }

  @Mutation(() => ErrorResponse)
  async deleteUser(
    @Arg('userId', () => ID) userId: string,
    @Ctx() { prisma }: TContext
  ): Promise<ErrorResponse> {
    try {
      await prisma.user.delete({
        where: { id: userId },
      });

      return { error: null };
    } catch (err) {
      console.log(err);
      throw err;
    }
  }
}
