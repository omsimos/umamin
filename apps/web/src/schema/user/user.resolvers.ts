/* eslint-disable no-console */
import {
  Resolver,
  Query,
  Mutation,
  Arg,
  Ctx,
  registerEnumType,
} from 'type-graphql';

import { hashPassword } from '@/utils/helpers';
import type { TContext } from '@/pages/api/graphql';
import { User } from '.';

export enum CacheControlScope {
  PUBLIC = 'PUBLIC', // eslint-disable-line no-unused-vars
  PRIVATE = 'PRIVATE', // eslint-disable-line no-unused-vars
}

registerEnumType(CacheControlScope, {
  name: 'CacheControlScope',
});

@Resolver()
export class UserResolver {
  @Query(() => User, { nullable: true })
  async getUser(
    @Arg('user', () => String) user: string,
    @Arg('type', () => String) type: 'id' | 'username',
    @Ctx() { prisma }: TContext
  ): Promise<User> {
    try {
      let data: User | null;

      if (type === 'id') {
        data = await prisma.user.findUnique({ where: { id: user } });
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
  async editUserMessage(
    @Arg('message', () => String) message: string,
    @Ctx() { prisma, id }: TContext
  ): Promise<String> {
    try {
      await prisma.user.update({
        where: { id },
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
    @Arg('username', () => String) username: string,
    @Ctx() { prisma, id }: TContext
  ): Promise<String> {
    const usernameRegex = /^[a-zA-Z0-9]+$/;

    try {
      if (!usernameRegex.test(username)) {
        throw new Error('Username must be alphanumeric');
      }

      const user = await prisma.user.findUnique({ where: { username } });

      if (user) {
        throw new Error('Username already taken');
      }

      await prisma.user.update({
        where: { id },
        data: { username },
      });

      return 'Username edited';
    } catch (err: any) {
      console.error(err);
      throw new Error(err.message);
    }
  }

  @Mutation(() => String)
  async changePassword(
    @Arg('newPassword', () => String) newPassword: string,
    @Ctx() { prisma, id }: TContext
  ): Promise<String> {
    const hashedPassword = hashPassword(newPassword);

    try {
      await prisma.user.findUnique({
        where: { id },
      });

      await prisma.user.update({
        where: { id },
        data: {
          password: hashedPassword,
        },
      });

      return 'Password changed';
    } catch (err: any) {
      console.error(err);
      throw new Error(err.message);
    }
  }

  @Mutation(() => String)
  async deleteUser(@Ctx() { prisma, id }: TContext): Promise<String> {
    try {
      await prisma.user.delete({
        where: { id },
      });

      return 'User deleted';
    } catch (err: any) {
      console.error(err);
      throw new Error(err.message);
    }
  }
}
