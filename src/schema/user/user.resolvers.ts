import { Resolver, Query, Arg } from 'type-graphql';
import { User } from '.';

@Resolver()
export class UserResolver {
  @Query(() => User)
  user(@Arg('username', () => String) username: string): User {
    return {
      username,
      pin: '123456',
    };
  }
}
