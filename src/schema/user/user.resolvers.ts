import { Resolver, Query, Arg } from 'type-graphql';

import { User } from '.';
import { prisma } from '@/db';

@Resolver()
export class UserResolver {
  @Query(() => User, { nullable: true })
  async user(
    @Arg('username', () => String) username: string
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
