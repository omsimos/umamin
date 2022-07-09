import { ObjectType, Field } from 'type-graphql';

@ObjectType()
export class User {
  @Field(() => String)
  username: string;

  @Field(() => Number)
  pin: number;
}
