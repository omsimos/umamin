/* eslint-disable no-console */
import { Resolver, Query, Arg, Ctx } from 'type-graphql';
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
    }

    return data;
  }
}
