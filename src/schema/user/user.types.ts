import { ObjectType, Field } from 'type-graphql';

@ObjectType()
export class User {
  @Field(() => String)
  username: string;

  @Field(() => String)
  password: string;

  @Field(() => String)
  message: string;
}
