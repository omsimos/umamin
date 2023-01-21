import { ObjectType, Field, ID, InputType } from 'type-graphql';
import { MaxLength, MinLength, IsNotEmpty } from 'class-validator';

@ObjectType()
export class BaseMessage {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  content: string;

  @Field(() => String)
  receiverMsg: string;

  @Field(() => Date)
  createdAt: Date;
}

@ObjectType()
export class RecentMessage extends BaseMessage {
  @Field(() => String, { nullable: true })
  clue: string | null;
}

@ObjectType()
export class SeenMessage extends BaseMessage {
  @Field(() => String, { nullable: true })
  reply: string | null;

  @Field(() => String, { nullable: true })
  clue: string | null;
}

@ObjectType()
export class SentMessage extends BaseMessage {
  @Field(() => String)
  username: string;

  @Field(() => String, { nullable: true })
  reply: string | null;
}

@InputType()
export class SendMessageInput {
  @IsNotEmpty()
  @Field(() => String)
  receiverUsername: string;

  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(200)
  @Field(() => String)
  content: string;

  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  @Field(() => String)
  receiverMsg: string;

  @MaxLength(100)
  @Field(() => String, { nullable: true })
  clue: string | null;
}
