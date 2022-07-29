/* eslint-disable no-console */
import { Resolver, Query, Mutation, Arg, Ctx } from 'type-graphql';

import { User } from '.';
import { hashPassword } from '@/utils';
import type { TContext } from '@/pages/api/graphql';

@Resolver()
export class UserResolver {
  @Query(() => User, { nullable: true })
  async user(
    @Arg('username', () => String) username: string,
    @Ctx() { prisma }: TContext
  ): Promise<User> {
    try {
      const data = await prisma.user.findUnique({ where: { username } });

      if (!data) {
        throw new Error('User not found');
      }

      return {
        username: data.username,
        message: data.message,
      };
    } catch (err: any) {
      console.error(err);
      throw new Error(err.message);
    }
  }

  @Mutation(() => String)
  async createUser(
    @Arg('username', () => String) username: string,
    @Arg('password', () => String) password: string,
    @Ctx() { prisma }: TContext
  ): Promise<String> {
    const usernameRegex = /^[a-zA-Z0-9]+$/;
    const hashedPassword = hashPassword(password);

    try {
      if (!usernameRegex.test(username)) {
        throw new Error('Username must be alphanumeric');
      }

      const user = await prisma.user.findUnique({
        where: { username },
      });

      if (user) {
        throw new Error('Username already taken');
      }

      await prisma.user.create({
        data: {
          username,
          password: hashedPassword,
        },
      });

      return 'User created';
    } catch (err: any) {
      console.error(err);
      throw new Error(err.message);
    }
  }

  @Mutation(() => String)
  async editUser(
    @Arg('username', () => String) username: string,
    @Arg('message', () => String) message: string,
    @Ctx() { prisma, username: user }: TContext
  ): Promise<String> {
    try {
      if (username !== user) {
        throw new Error('You can only edit your own profile');
      }

      await prisma.user.update({ where: { username }, data: { message } });
      return 'User edited';
    } catch (err: any) {
      console.error(err);
      throw new Error(err.message);
    }
  }
}
