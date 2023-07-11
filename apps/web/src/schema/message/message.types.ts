import { ObjectType, Field, ID, InputType, Directive } from 'type-graphql';
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

@Directive('@cacheControl(maxAge: 60)')
@ObjectType()
export class RecentMessage extends BaseMessage {
  @Field(() => String, { nullable: true })
  clue: string | null;
}

@ObjectType()
export class SeenMessage extends BaseMessage {
  @Field(() => ID)
  id: string;

  @Directive('@cacheControl(maxAge: 3600)')
  @Field(() => String)
  content: string;

  @Directive('@cacheControl(maxAge: 3600)')
  @Field(() => String)
  receiverMsg: string;

  @Directive('@cacheControl(maxAge: 3600)')
  @Field(() => Date)
  createdAt: Date;

  @Field(() => String, { nullable: true })
  reply: string | null;

  @Directive('@cacheControl(maxAge: 3600)')
  @Field(() => String, { nullable: true })
  clue: string | null;
}

@Directive('@cacheControl(maxAge: 120)')
@ObjectType()
export class SentMessage extends BaseMessage {
  @Field(() => String, { nullable: true })
  receiverUsername: string | null;

  @Field(() => String, { nullable: true })
  reply: string | null;

  @Field(() => String, { nullable: true })
  clue: string | null;
}

@InputType()
export class SendMessageInput {
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

  @IsNotEmpty()
  @Field(() => String)
  receiverUsername: string;
}
