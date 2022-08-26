/* eslint-disable no-console */
import { Resolver, Query, Mutation, Arg, Ctx } from 'type-graphql';

import { User } from '.';
import type { TContext } from '@/pages/api/graphql';

@Resolver()
export class UserResolver {
  @Query(() => User, { nullable: true })
  async user(
    @Arg('user', () => String) user: string,
    @Arg('type', () => String) type: 'email' | 'username',
    @Ctx() { prisma }: TContext
  ): Promise<User> {
    try {
      let data: User | null;

      if (type === 'email') {
        data = await prisma.user.findUnique({ where: { email: user } });
      } else {
        data = await prisma.user.findUnique({ where: { username: user } });
      }

      if (!data) {
        throw new Error('User not found');
      }

      return data;
    } catch (err: any) {
      console.error(err);
      throw new Error(err.message);
    }
  }

  @Mutation(() => String)
  async editUserMessage(
    @Arg('email', () => String) email: string,
    @Arg('message', () => String) message: string,
    @Ctx() { prisma }: TContext
  ): Promise<String> {
    try {
      await prisma.user.update({
        where: { email },
        data: { message },
      });

      return 'User message edited';
    } catch (err: any) {
      console.error(err);
      throw new Error(err.message);
    }
  }

  @Mutation(() => String)
  async editUsername(
    @Arg('email', () => String) email: string,
    @Arg('username', () => String) username: string,
    @Ctx() { prisma }: TContext
  ): Promise<String> {
    const usernameRegex = /^[a-zA-Z0-9]+$/;

    try {
      if (!usernameRegex.test(username)) {
        throw new Error('Username must be alphanumeric');
      }

      await prisma.user.update({
        where: { email },
        data: { username },
      });

      return 'Username edited';
    } catch (err: any) {
      console.error(err);
      throw new Error(err.message);
    }
  }

  @Mutation(() => String)
  async deleteUser(
    @Arg('email', () => String) email: string,
    @Ctx() { prisma }: TContext
  ): Promise<String> {
    try {
      await prisma.user.delete({
        where: { email },
      });

      return 'User deleted';
    } catch (err: any) {
      console.error(err);
      throw new Error(err.message);
    }
  }
}
