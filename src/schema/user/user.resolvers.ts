import { Resolver, Query } from 'type-graphql';
import { User } from '.';

@Resolver()
export class UserResolver {
  @Query(() => User)
  user(): User {
    return {
      id: '1',
      username: 'johndoe',
      pin: '123456',
    };
  }
}
