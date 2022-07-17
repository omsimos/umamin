/* eslint-disable no-console */
import { Resolver, Mutation, Arg, Ctx } from 'type-graphql';
import { customAlphabet } from 'nanoid';

import { User } from '.';
import { hashPassword } from '@/utils';
import type { TContext } from '@/pages/api/graphql';

@Resolver()
export class UserResolver {
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
