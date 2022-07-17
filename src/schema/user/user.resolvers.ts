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

      return data;
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
}
