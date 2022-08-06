import { ObjectType, Field } from 'type-graphql';

@ObjectType()
export class User {
  @Field(() => String)
  username: string;

  @Field(() => String)
  password: string;

  @Field(() => String)
  message: string;

  @Field(() => String, { nullable: true })
  email: string | null;

  @Field(() => String, { nullable: true })
  image: string | null;
}
