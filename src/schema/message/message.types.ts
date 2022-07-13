import { ObjectType, Field } from 'type-graphql';

@ObjectType()
export class Message {
  @Field(() => String)
  id: string;

  @Field(() => String)
  content: string;

  @Field(() => String)
  sentFor: string;

  @Field(() => Date)
  createdAt: Date;
}
