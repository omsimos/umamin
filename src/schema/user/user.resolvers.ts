/* eslint-disable no-console */
import { Resolver, Query, Mutation, Arg, Ctx } from 'type-graphql';
import { customAlphabet } from 'nanoid';

import { User } from '.';
import type { TContext } from '@/pages/api/graphql';
import { hashPassword, isPassword } from '@/utils';

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
    const pin = customAlphabet('1234567890', 6);
    const defaultPassword = pin();

    const password = hashPassword(defaultPassword);

    try {
      const user = await prisma.user.findUnique({
        where: { username },
      });

      if (user) {
        throw new Error('Link already taken');
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
