/* eslint-disable no-console */
import { Resolver, Query, Mutation, Arg, Ctx } from 'type-graphql';
import { customAlphabet } from 'nanoid';

import { User } from '.';
import { hashPassword, isPassword } from '@/utils';
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
  async login(
    @Arg('username', () => String) username: string,
    @Arg('password', () => String) password: string,
    @Ctx() { prisma }: TContext
  ): Promise<String | null> {
    const data = await this.user(username, { prisma });

    if (isPassword(password, data.password)) {
      throw new Error('Incorrect credentials');
    }

    return data.username;
  }

  @Mutation(() => User)
  async createUser(
    @Arg('username', () => String) username: string,
    @Ctx() { prisma }: TContext
  ): Promise<User | null> {
    const usernameRegex = /^[a-zA-Z0-9]+$/;
    const pin = customAlphabet('1234567890', 6);
    const defaultPassword = pin();

    const password = hashPassword(defaultPassword);

    try {
      const user = await prisma.user.findUnique({
        where: { username },
      });

      if (user) {
        throw new Error('Username already taken');
      }

      if (!usernameRegex.test(username)) {
        throw new Error('Username must be alphanumeric');
      }

      await prisma.user.create({
        data: {
          username,
          password,
        },
      });
    } catch (err: any) {
      console.error(err);
      throw new Error(err.message);
    }

    return {
      username,
      password: defaultPassword,
    };
  }
}
