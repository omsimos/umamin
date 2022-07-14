import { ObjectType, Field, ID } from 'type-graphql';

@ObjectType()
export class Message {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  content: string;

  @Field(() => String, { nullable: true })
  senderId: string | null;

  @Field(() => String)
  receiverId: string;
}
