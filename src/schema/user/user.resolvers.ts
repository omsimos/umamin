/* eslint-disable no-console */
import { Resolver, Query, Mutation, Arg, Ctx } from 'type-graphql';
import { customAlphabet } from 'nanoid';
import bcrypt from 'bcrypt';

import { User } from '.';
import type { TContext } from '@/pages/api/graphql';

@Resolver()
export class UserResolver {
  @Query(() => User, { nullable: true })
  async user(
    @Arg('username', () => String) username: string,
    @Ctx() { prisma }: TContext
  ): Promise<User | null> {
    let data = {} as User | null;

    try {
      data = await prisma.user.findUnique({ where: { username } });
    } catch (err) {
      console.error(err);
      // throw error or we could create a custom error class
      throw new Error('User not found');
    }

    return data;
  }

  @Mutation(() => User, { nullable: true })
  async createUser(
    @Arg('username', () => String) username: string,
    @Ctx() { prisma }: TContext
  ): Promise<User | null> {
    const pin = customAlphabet('1234567890', 6);
    const defaultPassword = pin();

    const password = await bcrypt.hash(defaultPassword, 10);

    try {
      const user = await prisma.user.findUnique({
        where: { username },
      });

      if (user) {
        return null;
      }

      await prisma.user.create({
        data: {
          username,
          password,
        },
      });
    } catch (err) {
      console.error(err);
      throw new Error('User not created');
    }

    return {
      username,
      password: defaultPassword,
    };
  }
}
